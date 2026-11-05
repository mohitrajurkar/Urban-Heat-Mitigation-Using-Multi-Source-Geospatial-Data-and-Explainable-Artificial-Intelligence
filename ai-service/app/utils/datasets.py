"""Dataset registry: bundled demonstration datasets + user uploads, each with metadata."""
from __future__ import annotations

import json
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from app.config import SAMPLE_DIR, UPLOAD_DIR
from app.geospatial.raster_io import inspect_raster
from app.utils.errors import NotFoundError, ServiceError

log = logging.getLogger(__name__)

DATA_TYPES = {
    "landsat": {".tif", ".tiff"},
    "sentinel2": {".tif", ".tiff"},
    "lulc": {".tif", ".tiff"},
    "population": {".tif", ".tiff", ".csv"},
    "meteorological": {".csv"},
    "roads": {".geojson", ".json"},
    "boundary": {".geojson", ".json"},
}
LANDSAT_MIN_BANDS = 7  # B2, B3, B4, B5, B6, B7, B10


def _demo_catalog() -> list[dict]:
    path = SAMPLE_DIR / "catalog.json"
    if not path.exists():
        return []
    items = json.loads(path.read_text(encoding="utf-8"))
    for it in items:
        it["path"] = str(SAMPLE_DIR / it["file_name"])
        it["origin"] = "bundled-demo"
    return items


def list_datasets(data_type: str | None = None) -> list[dict]:
    items = _demo_catalog()
    for meta in sorted(UPLOAD_DIR.glob("*/meta.json")):
        try:
            items.append(json.loads(meta.read_text(encoding="utf-8")))
        except json.JSONDecodeError:
            log.warning("Skipping corrupt dataset metadata %s", meta)
    if data_type:
        items = [i for i in items if i["data_type"] == data_type]
    return items


def get_dataset(dataset_id: str) -> dict:
    for item in list_datasets():
        if item["dataset_id"] == dataset_id:
            if not Path(item["path"]).exists():
                raise NotFoundError(f"File for dataset '{dataset_id}' is missing on disk")
            return item
    raise NotFoundError(f"Dataset '{dataset_id}' not found")


def inspect_file(path: Path, data_type: str) -> dict:
    ext = path.suffix.lower()
    if ext in (".tif", ".tiff"):
        info = inspect_raster(path)
        if data_type == "landsat" and info["band_count"] < LANDSAT_MIN_BANDS:
            raise ServiceError(f"Landsat stack needs {LANDSAT_MIN_BANDS} bands (B2,B3,B4,B5,B6,B7,B10); file has {info['band_count']}")
        if data_type == "sentinel2" and info["band_count"] < 4:
            raise ServiceError("Sentinel-2 stack needs at least 4 bands (B03, B04, B08, B11)")
        return info
    if ext == ".csv":
        try:
            df = pd.read_csv(path, nrows=5000)
        except Exception as exc:  # noqa: BLE001
            raise ServiceError(f"Unreadable CSV: {exc}") from exc
        cols = [c.strip().lower() for c in df.columns]
        required = {"meteorological": ["station_id", "latitude", "longitude", "date", "air_temp_max_c"],
                    "population": ["latitude", "longitude", "population"]}.get(data_type, [])
        missing = [c for c in required if c not in cols]
        if missing:
            raise ServiceError(f"CSV is missing required columns for {data_type}: {missing}")
        return {"rows_previewed": int(len(df)), "columns": cols}
    if ext in (".geojson", ".json"):
        import geopandas as gpd

        try:
            gdf = gpd.read_file(path)
        except Exception as exc:  # noqa: BLE001
            raise ServiceError(f"Unreadable GeoJSON: {exc}") from exc
        if gdf.empty:
            raise ServiceError("GeoJSON has no features")
        return {"features": int(len(gdf)), "geometry_types": sorted(set(gdf.geom_type.dropna())),
                "crs": str(gdf.crs) if gdf.crs else "EPSG:4326 (assumed)", "bounds_lonlat": [round(v, 6) for v in gdf.to_crs(4326).total_bounds]}
    raise ServiceError(f"Unsupported file extension '{ext}'")


def register_upload(src_path: Path, original_name: str, meta: dict) -> dict:
    data_type = meta.get("data_type")
    if data_type not in DATA_TYPES:
        raise ServiceError(f"data_type must be one of {sorted(DATA_TYPES)}")
    ext = Path(original_name).suffix.lower()
    if ext not in DATA_TYPES[data_type]:
        raise ServiceError(f"{data_type} datasets must be one of {sorted(DATA_TYPES[data_type])}, got '{ext}'")
    dataset_id = f"ds-{uuid.uuid4().hex[:12]}"
    target_dir = UPLOAD_DIR / dataset_id
    target_dir.mkdir(parents=True)
    safe_name = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in Path(original_name).name)
    target = target_dir / safe_name
    shutil.move(str(src_path), target)
    try:
        info = inspect_file(target, data_type)
    except Exception:
        shutil.rmtree(target_dir, ignore_errors=True)
        raise
    record = {
        "dataset_id": dataset_id,
        "name": meta.get("name") or Path(original_name).stem,
        "data_type": data_type,
        "source": meta.get("source") or "User upload",
        "collection_date": meta.get("collection_date"),
        "coverage": meta.get("coverage"),
        "file_format": {".tif": "GeoTIFF", ".tiff": "GeoTIFF", ".csv": "CSV"}.get(ext, "GeoJSON"),
        "file_name": safe_name,
        "file_size": target.stat().st_size,
        "is_demo": bool(meta.get("is_demo", False)),
        "is_real": bool(meta.get("is_real", True)),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "inspection": info,
        "path": str(target),
        "origin": "upload",
    }
    for key in ("landsat_params", "sentinel2_params", "lulc_mapping"):
        if meta.get(key):
            record[key] = meta[key]
    (target_dir / "meta.json").write_text(json.dumps(record, indent=2, default=str), encoding="utf-8")
    log.info("Registered dataset %s (%s, %s)", dataset_id, data_type, safe_name)
    return record


def delete_dataset(dataset_id: str) -> None:
    if dataset_id.startswith("demo-"):
        raise ServiceError("Bundled demonstration datasets cannot be deleted")
    target = UPLOAD_DIR / dataset_id
    if not target.exists() or not (target / "meta.json").exists():
        raise NotFoundError(f"Dataset '{dataset_id}' not found")
    shutil.rmtree(target)


def default_demo_selection() -> dict:
    return {
        "landsat": "demo-landsat9",
        "sentinel2": "demo-sentinel2",
        "lulc": "demo-lulc",
        "meteorological": "demo-meteo",
        "population": "demo-population",
        "roads": "demo-roads",
    }
