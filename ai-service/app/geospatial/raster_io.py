"""Raster I/O helpers: inspection, CRS conversion and resampling onto the analysis grid."""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.warp import reproject, transform_bounds

from app.geospatial.grid import AnalysisGrid
from app.utils.errors import ServiceError

log = logging.getLogger(__name__)

RESAMPLING = {
    "average": Resampling.average,
    "bilinear": Resampling.bilinear,
    "nearest": Resampling.nearest,
    "mode": Resampling.mode,
    "sum": Resampling.sum,
}


def inspect_raster(path: Path) -> dict:
    try:
        with rasterio.open(path) as ds:
            if ds.crs is None:
                raise ServiceError("GeoTIFF has no coordinate reference system (CRS)")
            bounds_ll = transform_bounds(ds.crs, CRS.from_epsg(4326), *ds.bounds)
            return {
                "driver": ds.driver,
                "width": ds.width,
                "height": ds.height,
                "band_count": ds.count,
                "dtype": ds.dtypes[0],
                "crs": ds.crs.to_string(),
                "resolution": [abs(ds.transform.a), abs(ds.transform.e)],
                "nodata": ds.nodata,
                "band_descriptions": [d or f"band_{i + 1}" for i, d in enumerate(ds.descriptions)],
                "bounds_lonlat": [round(v, 6) for v in bounds_ll],
                "tags": ds.tags(),
            }
    except rasterio.errors.RasterioIOError as exc:
        raise ServiceError(f"Not a readable GeoTIFF: {exc}") from exc


def reproject_to_grid(
    path: Path,
    grid: AnalysisGrid,
    bands: list[int] | None = None,
    resampling: str = "average",
    src_nodata: float | None = None,
) -> np.ndarray:
    """Reproject/resample raster bands (1-based indexes) onto the grid. Returns float32 (bands, H, W), NaN = no data."""
    with rasterio.open(path) as src:
        idx = bands or list(range(1, src.count + 1))
        if max(idx) > src.count:
            raise ServiceError(f"{path.name}: band {max(idx)} requested but file has {src.count} bands")
        nodata = src_nodata if src_nodata is not None else src.nodata
        out = np.full((len(idx), grid.height, grid.width), np.nan, dtype=np.float32)
        for i, b in enumerate(idx):
            data = src.read(b).astype(np.float32)
            if nodata is not None:
                data[data == nodata] = np.nan
            reproject(
                source=data,
                destination=out[i],
                src_transform=src.transform,
                src_crs=src.crs,
                src_nodata=np.nan,
                dst_transform=grid.transform,
                dst_crs=CRS.from_epsg(grid.epsg),
                dst_nodata=np.nan,
                resampling=RESAMPLING[resampling],
            )
    log.info("Resampled %s bands %s -> grid %sx%s (%s)", path.name, idx, grid.height, grid.width, resampling)
    return out


def array_to_lonlat(arr: np.ndarray, grid: AnalysisGrid, resampling: str = "nearest") -> tuple[np.ndarray, list[float]]:
    """Warp a grid array into EPSG:4326 (used for map overlays). Returns array and [w, s, e, n]."""
    from rasterio.warp import calculate_default_transform

    left, bottom, right, top = grid.bounds()
    dst_crs = CRS.from_epsg(4326)
    transform, width, height = calculate_default_transform(CRS.from_epsg(grid.epsg), dst_crs, grid.width, grid.height, left, bottom, right, top)
    dst = np.full((height, width), np.nan, dtype=np.float32)
    reproject(
        source=arr.astype(np.float32),
        destination=dst,
        src_transform=grid.transform,
        src_crs=CRS.from_epsg(grid.epsg),
        src_nodata=np.nan,
        dst_transform=transform,
        dst_crs=dst_crs,
        dst_nodata=np.nan,
        resampling=RESAMPLING[resampling],
    )
    west, north = transform.c, transform.f
    east, south = west + transform.a * width, north + transform.e * height
    return dst, [west, south, east, north]
