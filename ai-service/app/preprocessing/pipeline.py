"""Preprocessing step: CRS conversion, resampling, calibration, invalid pixel handling, data fusion."""
from __future__ import annotations

import json
import logging
import time
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from pyproj import Transformer

from app.features import indices
from app.geospatial.grid import AnalysisGrid
from app.geospatial.raster_io import reproject_to_grid
from app.geospatial.study_area import get_study_area
from app.preprocessing.cleaning import aggregate_stations, clean_meteorological, idw_interpolate
from app.utils import run_store
from app.utils.datasets import get_dataset
from app.utils.errors import ServiceError

log = logging.getLogger(__name__)

DEFAULT_MET = {"air_temp_max_c": 41.0, "relative_humidity_pct": 22.0, "wind_speed_ms": 3.0}


def _landsat(ds: dict, grid: AnalysisGrid, report: dict) -> dict[str, np.ndarray]:
    params = {**indices.LANDSAT_L1_DEFAULTS, **(ds.get("landsat_params") or {})}
    level = str(params.get("PRODUCT_LEVEL", "L1")).upper()
    raw = reproject_to_grid(Path(ds["path"]), grid, bands=list(range(1, 8)), resampling="average", src_nodata=0)
    saturated = np.any(raw >= 65535, axis=0)
    raw[:, saturated] = np.nan
    report["landsat"] = {"product_level": level, "saturated_pixels_masked": int(saturated.sum())}
    if level == "L2":
        refl = indices.l2_surface_reflectance(raw[:6])
        st = raw[6] * indices.LANDSAT_L2_ST_MULT + indices.LANDSAT_L2_ST_ADD
        st[~np.isfinite(raw[6]) | (raw[6] <= 0)] = np.nan
        out = {"bt_k": st, "lst_is_surface_temperature": np.array(True)}
        report["landsat"]["calibration"] = "Collection 2 L2 SR/ST scale factors"
    else:
        sun = float(params["SUN_ELEVATION"])
        refl = np.stack([indices.dn_to_toa_reflectance(raw[i], params["REFLECTANCE_MULT"], params["REFLECTANCE_ADD"], sun) for i in range(6)])
        rad = indices.dn_to_radiance(raw[6], params["RADIANCE_MULT_B10"], params["RADIANCE_ADD_B10"])
        bt = indices.radiance_to_brightness_temperature(rad, params["K1_CONSTANT_BAND_10"], params["K2_CONSTANT_BAND_10"])
        out = {"bt_k": bt, "lst_is_surface_temperature": np.array(False)}
        report["landsat"]["calibration"] = f"L1 DN -> TOA reflectance (sun elevation {sun} deg) and B10 radiance -> brightness temperature"
    for i, name in enumerate(["blue", "green", "red", "nir", "swir1", "swir2"]):
        out[name] = refl[i]
    valid = np.all(np.isfinite(refl), axis=0) & np.isfinite(out["bt_k"])
    out["valid"] = valid
    report["landsat"]["valid_pixel_pct"] = round(100 * float(valid.mean()), 2)
    report["landsat"]["invalid_pixels"] = int((~valid).sum())
    return out


def _sentinel2_fusion(ds: dict, grid: AnalysisGrid, bands: dict, report: dict) -> None:
    params = ds.get("sentinel2_params") or {}
    q = float(params.get("BOA_QUANTIFICATION_VALUE", 10000))
    off = float(params.get("BOA_ADD_OFFSET", 0))
    raw = reproject_to_grid(Path(ds["path"]), grid, bands=[1, 2, 3, 4], resampling="average", src_nodata=0)
    s2 = (raw + off) / q
    s2[(s2 < 0) | (s2 > 1.2)] = np.nan
    cover = np.all(np.isfinite(s2), axis=0)
    for i, name in enumerate(["green", "red", "nir", "swir1"]):
        # harmonise to the Landsat level with a per-band linear fit on overlapping valid pixels
        ls = bands[name]
        both = cover & np.isfinite(ls)
        if both.sum() > 100:
            a, b = np.polyfit(s2[i][both], ls[both], 1)
            bands[name] = np.where(cover, a * s2[i] + b, ls)
    report["sentinel2"] = {"pixels_fused": int(cover.sum()), "coverage_pct": round(100 * float(cover.mean()), 2),
                           "method": "20 m bands averaged to grid, linearly harmonised to Landsat, preferred where available"}


def _lulc(ds: dict | None, grid: AnalysisGrid, report: dict) -> np.ndarray | None:
    if not ds:
        report["lulc"] = {"source": "derived from spectral indices (no LULC dataset selected)"}
        return None
    arr = reproject_to_grid(Path(ds["path"]), grid, bands=[1], resampling="mode", src_nodata=0)[0]
    arr = np.where(np.isfinite(arr), arr, 0).astype(np.int32)
    mapping = ds.get("lulc_mapping")
    if mapping == "esa_worldcover":
        mapping = indices.ESA_WORLDCOVER_MAP
    if isinstance(mapping, dict):
        arr = indices.remap_lulc(arr, {int(k): int(v) for k, v in mapping.items()})
    arr[(arr < 0) | (arr > 8)] = 0
    report["lulc"] = {"source": ds["name"], "resampling": "mode (majority)", "unclassified_pixels": int((arr == 0).sum())}
    return arr.astype(np.uint8)


def _meteorology(ds: dict | None, grid: AnalysisGrid, report: dict) -> dict[str, np.ndarray]:
    gx, gy = grid.pixel_centers()
    if not ds:
        report["meteorological"] = {"source": "defaults (no meteorological dataset selected)", "values": DEFAULT_MET}
        return {k: np.full(grid.shape, v) for k, v in DEFAULT_MET.items()}
    df, qa = clean_meteorological(pd.read_csv(ds["path"]))
    st = aggregate_stations(df)
    tr = Transformer.from_crs(4326, grid.epsg, always_xy=True)
    sx, sy = tr.transform(st["longitude"].values, st["latitude"].values)
    out = {}
    for col, default in DEFAULT_MET.items():
        out[col] = idw_interpolate(sx, sy, st[col].values, gx, gy) if col in st else np.full(grid.shape, default)
    qa["interpolation"] = "inverse distance weighting (power 2) of station period means"
    qa["station_means"] = st.round(2).to_dict(orient="records")
    report["meteorological"] = qa
    return out


def _population(ds: dict | None, grid: AnalysisGrid, report: dict) -> np.ndarray:
    if not ds:
        report["population"] = {"source": "not provided - vulnerability will rely on built-up density"}
        return np.full(grid.shape, np.nan)
    path = Path(ds["path"])
    if path.suffix.lower() == ".csv":
        df = pd.read_csv(path)
        df.columns = [c.strip().lower() for c in df.columns]
        x, y = Transformer.from_crs(4326, grid.epsg, always_xy=True).transform(df["longitude"].values, df["latitude"].values)
        r, c = grid.xy_to_pixel(x, y)
        ok = (r >= 0) & (r < grid.height) & (c >= 0) & (c < grid.width)
        counts = np.zeros(grid.shape)
        np.add.at(counts, (r[ok], c[ok]), df["population"].values[ok])
    else:
        counts = reproject_to_grid(path, grid, bands=[1], resampling="sum")[0]
        counts = np.where(np.isfinite(counts) & (counts >= 0), counts, 0)
    density = counts / grid.pixel_area_km2
    report["population"] = {"source": ds["name"], "total_population_in_grid": int(np.nansum(counts))}
    return density


def _roads(ds: dict | None, grid: AnalysisGrid, report: dict) -> np.ndarray | None:
    """Road length per analysis cell (km / km2)."""
    if not ds:
        report["roads"] = {"source": "not provided"}
        return None
    import geopandas as gpd
    from shapely.geometry import box

    gdf = gpd.read_file(ds["path"])
    if gdf.crs is None:
        gdf = gdf.set_crs(4326)
    gdf = gdf.to_crs(grid.epsg)
    n_r, n_c = grid.cell_shape
    size = grid.resolution * grid.cell_px
    cells = gpd.GeoDataFrame(
        {"cell_index": np.arange(n_r * n_c)},
        geometry=[box(grid.xmin + c * size, grid.ymax - (r + 1) * size, grid.xmin + (c + 1) * size, grid.ymax - r * size) for r in range(n_r) for c in range(n_c)],
        crs=grid.epsg,
    )
    inter = gpd.overlay(gdf[["geometry"]], cells, how="intersection", keep_geom_type=True)
    lengths = inter.assign(km=inter.length / 1000).groupby("cell_index")["km"].sum()
    dens = np.zeros(n_r * n_c)
    dens[lengths.index.values] = lengths.values / grid.cell_area_km2
    report["roads"] = {"source": ds["name"], "segments": int(len(gdf)), "total_km": round(float(lengths.sum()), 1)}
    return dens


def preprocess(study_area_name: str | None, dataset_ids: dict, run_id: str | None = None, overrides: dict | None = None) -> dict:
    t0 = time.time()
    sa = replace(get_study_area(study_area_name))  # copy: overrides must not mutate the shared config
    for key in ("resolution_m", "cell_size_m"):
        if overrides and overrides.get(key):
            setattr(sa, key, int(overrides[key]))
    if not dataset_ids.get("landsat"):
        raise ServiceError("A Landsat 8/9 dataset is required (it provides the thermal band for LST)")
    grid = AnalysisGrid.from_study_area(sa)
    run_id = run_id or run_store.new_run_id()
    run_store.run_dir(run_id, must_exist=False)
    datasets = {k: get_dataset(v) for k, v in dataset_ids.items() if v}
    report: dict = {"grid": grid.to_dict(), "crs": f"EPSG:{grid.epsg}", "target_resolution_m": grid.resolution}

    bands = _landsat(datasets["landsat"], grid, report)
    if "sentinel2" in datasets:
        _sentinel2_fusion(datasets["sentinel2"], grid, bands, report)
    lulc = _lulc(datasets.get("lulc"), grid, report)
    met = _meteorology(datasets.get("meteorological"), grid, report)
    pop = _population(datasets.get("population"), grid, report)
    roads = _roads(datasets.get("roads"), grid, report)

    arrays = {k: v for k, v in bands.items()}
    arrays.update({f"met_{k}": v for k, v in met.items()})
    arrays["population_density"] = pop
    if lulc is not None:
        arrays["lulc"] = lulc
    if roads is not None:
        arrays["road_density_cells"] = roads
    np.savez_compressed(run_store.run_dir(run_id) / "preprocessed.npz", **arrays)

    used = {k: {"dataset_id": d["dataset_id"], "name": d["name"], "source": d.get("source"), "is_demo": d.get("is_demo", False),
                "is_real": d.get("is_real", True), "collection_date": d.get("collection_date")} for k, d in datasets.items()}
    report["datasets"] = used
    report["elapsed_seconds"] = round(time.time() - t0, 2)
    run_meta = {"run_id": run_id, "study_area": sa.to_dict(), "datasets": used, "created_at": datetime.now(timezone.utc).isoformat(),
                "uses_demo_data": any(d["is_demo"] for d in used.values())}
    run_store.write_json(run_id, "run.json", run_meta)
    run_store.write_json(run_id, "grid.json", grid.to_dict())
    run_store.write_json(run_id, "preprocess.json", report)
    log.info("Preprocessed run %s in %.1fs", run_id, report["elapsed_seconds"])
    return {"run_id": run_id, "study_area": sa.to_dict(), "report": json.loads(json.dumps(run_store.clean_json(report), default=str))}
