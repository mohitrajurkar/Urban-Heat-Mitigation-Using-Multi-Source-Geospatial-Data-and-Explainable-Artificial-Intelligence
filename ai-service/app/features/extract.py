"""Feature extraction: environmental indicators per pixel and aggregation to analysis regions."""
from __future__ import annotations

import logging
import time

import matplotlib

matplotlib.use("Agg")
import matplotlib.image as mpimg  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib import colormaps  # noqa: E402
from matplotlib.colors import ListedColormap  # noqa: E402

from app.features import indices  # noqa: E402
from app.geospatial.grid import AnalysisGrid  # noqa: E402
from app.geospatial.raster_io import array_to_lonlat  # noqa: E402
from app.geospatial.study_area import nearest_locality  # noqa: E402
from app.preprocessing.cleaning import clip_outliers, fill_small_gaps  # noqa: E402
from app.utils import run_store  # noqa: E402

log = logging.getLogger(__name__)

LULC_COLORS = {0: "#00000000", 1: "#2b7bba", 2: "#1b5e20", 3: "#66bb6a", 4: "#d4c26a", 5: "#c8a27a", 6: "#e57373", 7: "#b71c1c", 8: "#6d4c41"}
LAYER_STYLE = {
    "lst": {"label": "Land Surface Temperature", "unit": "°C", "cmap": "RdYlBu_r"},
    "ndvi": {"label": "NDVI", "unit": "", "cmap": "RdYlGn"},
    "ndbi": {"label": "NDBI", "unit": "", "cmap": "YlOrBr"},
    "ndwi": {"label": "NDWI", "unit": "", "cmap": "Blues"},
    "albedo": {"label": "Surface Albedo", "unit": "", "cmap": "cividis"},
}
MIN_VALID_FRACTION_FOR_LABEL = 0.5


def compute_indicators(pre: dict) -> tuple[dict[str, np.ndarray], dict]:
    qa: dict = {}
    valid = pre["valid"].astype(bool)
    b = {k: np.where(valid, pre[k], np.nan) for k in ("blue", "green", "red", "nir", "swir1", "swir2", "bt_k")}
    out = {
        "ndvi": indices.ndvi(b["nir"], b["red"]),
        "ndbi": indices.ndbi(b["swir1"], b["nir"]),
        "ndwi": indices.ndwi(b["green"], b["nir"]),
        "albedo": indices.surface_albedo_landsat(b["blue"], b["red"], b["nir"], b["swir1"], b["swir2"]),
    }
    out["albedo"][~valid] = np.nan
    if bool(pre.get("lst_is_surface_temperature", False)):
        lst = b["bt_k"] - 273.15
        qa["lst_method"] = "Landsat Collection 2 L2 surface temperature product (ST_B10)"
    else:
        eps = indices.emissivity_from_ndvi(out["ndvi"], out["ndwi"])
        lst = indices.land_surface_temperature(b["bt_k"], eps)
        out["emissivity"] = eps
        qa["lst_method"] = "Single-channel: B10 radiance -> brightness temperature -> NDVI-threshold emissivity correction"
    out["lst"] = lst

    for k in ("ndvi", "ndbi", "ndwi", "albedo", "lst"):
        filled, n_fill = fill_small_gaps(out[k], max_distance_px=1.5)
        clipped, n_clip = clip_outliers(filled, 0.2, 99.8)
        out[k] = clipped
        qa[k] = {"gap_filled_pixels": n_fill, "outliers_winsorised": n_clip, "valid_pixels": int(np.isfinite(clipped).sum())}

    if "lulc" in pre:
        lulc = pre["lulc"].astype(np.uint8)
        derived = indices.classify_lulc_from_indices(out["ndvi"], out["ndbi"], out["ndwi"])
        lulc = np.where(lulc == 0, derived, lulc)
        qa["lulc_source"] = "classified LULC dataset (gaps filled from index-based rules)"
    else:
        lulc = indices.classify_lulc_from_indices(out["ndvi"], out["ndbi"], out["ndwi"])
        qa["lulc_source"] = "index-based rule classification"
    out["lulc"] = lulc
    return out, qa


def _cell_reduce(values: np.ndarray, cell_idx: np.ndarray, n_cells: int, how: str) -> np.ndarray:
    flat_v, flat_c = values.ravel(), cell_idx.ravel()
    ok = (flat_c >= 0) & np.isfinite(flat_v)
    v, c = flat_v[ok], flat_c[ok]
    cnt = np.bincount(c, minlength=n_cells).astype(float)
    if how == "count":
        return cnt
    s = np.bincount(c, weights=v, minlength=n_cells)
    if how == "sum":
        return s
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = s / cnt
        if how == "mean":
            return mean
        if how == "std":
            s2 = np.bincount(c, weights=v * v, minlength=n_cells)
            return np.sqrt(np.maximum(s2 / cnt - mean**2, 0))
    if how in ("max", "min"):
        res = np.full(n_cells, -np.inf if how == "max" else np.inf)
        (np.maximum if how == "max" else np.minimum).at(res, c, v)
        res[~np.isfinite(res)] = np.nan
        return res
    raise ValueError(how)


def aggregate_regions(ind: dict, pre: dict, grid: AnalysisGrid) -> list[dict]:
    cell_idx = grid.cell_index()
    n_r, n_c = grid.cell_shape
    n = n_r * n_c
    px_per_cell = grid.cell_px**2
    stats = {
        "lst_mean": _cell_reduce(ind["lst"], cell_idx, n, "mean"),
        "lst_max": _cell_reduce(ind["lst"], cell_idx, n, "max"),
        "lst_min": _cell_reduce(ind["lst"], cell_idx, n, "min"),
        "lst_std": _cell_reduce(ind["lst"], cell_idx, n, "std"),
        "ndvi_mean": _cell_reduce(ind["ndvi"], cell_idx, n, "mean"),
        "ndbi_mean": _cell_reduce(ind["ndbi"], cell_idx, n, "mean"),
        "ndwi_mean": _cell_reduce(ind["ndwi"], cell_idx, n, "mean"),
        "albedo_mean": _cell_reduce(ind["albedo"], cell_idx, n, "mean"),
        "air_temp_max": _cell_reduce(pre["met_air_temp_max_c"], cell_idx, n, "mean"),
        "relative_humidity": _cell_reduce(pre["met_relative_humidity_pct"], cell_idx, n, "mean"),
        "wind_speed": _cell_reduce(pre["met_wind_speed_ms"], cell_idx, n, "mean"),
        "population_density": _cell_reduce(pre["population_density"], cell_idx, n, "mean"),
        "valid_pixel_pct": 100 * _cell_reduce(ind["lst"], cell_idx, n, "count") / px_per_cell,
    }
    stats["population"] = stats["population_density"] * grid.cell_area_km2
    lulc = ind["lulc"]
    frac = {c: _cell_reduce((lulc == c).astype(float), cell_idx, n, "mean") for c in range(1, 9)}
    stats["built_fraction"] = frac[6] + frac[7] + frac[8]
    stats["vegetation_fraction"] = frac[2] + frac[3]
    stats["water_fraction"] = frac[1]
    stats["open_land_fraction"] = frac[4] + frac[5]
    road = pre.get("road_density_cells")
    stats["road_density"] = road if road is not None else np.full(n, np.nan)
    frac_mat = np.stack([frac[c] for c in range(1, 9)], axis=1)

    cells = grid.cell_polygons_lonlat()
    regions = []
    for cell in cells:
        i = cell["cell_index"]
        lon, lat = cell["centroid"]
        locality = nearest_locality(lat, lon)
        rec = {
            "cell_index": i,
            "region_code": f"NGP-{cell['row']:02d}-{cell['col']:02d}",
            "name": f"{locality} {cell['row']:02d}-{cell['col']:02d}",
            "locality": locality,
            "row": cell["row"],
            "col": cell["col"],
            "centroid": cell["centroid"],
            "geometry": {"type": "Polygon", "coordinates": [cell["ring"]]},
            "area_km2": round(grid.cell_area_km2, 4),
            "lulc_majority": int(np.argmax(frac_mat[i]) + 1),
            "lulc_fractions": {indices.LULC_CLASSES[c]: round(float(frac[c][i]), 4) for c in range(1, 9)},
        }
        for k, arr in stats.items():
            v = float(arr[i])
            rec[k] = round(v, 5) if np.isfinite(v) else None
        rec["lulc_majority_name"] = indices.LULC_CLASSES[rec["lulc_majority"]]
        rec["label_quality_ok"] = bool(rec["valid_pixel_pct"] is not None and rec["valid_pixel_pct"] >= 100 * MIN_VALID_FRACTION_FOR_LABEL and rec["lst_mean"] is not None)
        regions.append(rec)
    return regions


def render_layers(run_id: str, ind: dict, grid: AnalysisGrid) -> dict:
    layer_dir = run_store.run_dir(run_id) / "layers"
    layer_dir.mkdir(exist_ok=True)
    meta = {}
    for name, style in LAYER_STYLE.items():
        arr, bounds = array_to_lonlat(ind[name], grid, "bilinear")
        finite = arr[np.isfinite(arr)]
        vmin, vmax = (float(np.percentile(finite, 2)), float(np.percentile(finite, 98))) if finite.size else (0.0, 1.0)
        norm = np.clip((arr - vmin) / max(vmax - vmin, 1e-9), 0, 1)
        cmap = colormaps[style["cmap"]]
        rgba = cmap(np.nan_to_num(norm))
        rgba[..., 3] = np.where(np.isfinite(arr), 0.85, 0.0)
        mpimg.imsave(layer_dir / f"{name}.png", rgba)
        stops = [{"value": round(vmin + t * (vmax - vmin), 3), "color": matplotlib.colors.to_hex(cmap(t))} for t in np.linspace(0, 1, 6)]
        meta[name] = {**style, "bounds": bounds, "vmin": vmin, "vmax": vmax, "stops": stops}
    arr, bounds = array_to_lonlat(ind["lulc"].astype(np.float32), grid, "nearest")
    cmap = ListedColormap([LULC_COLORS[i] for i in range(9)])
    rgba = cmap(np.nan_to_num(arr).astype(int))
    rgba[..., 3] = np.where(np.nan_to_num(arr) > 0, 0.85, 0.0)
    mpimg.imsave(layer_dir / "lulc.png", rgba)
    meta["lulc"] = {"label": "Land Use / Land Cover", "unit": "", "bounds": bounds, "categories": [{"value": k, "label": v, "color": LULC_COLORS[k]} for k, v in indices.LULC_CLASSES.items()]}
    run_store.write_json(run_id, "layers.json", meta)
    return meta


def city_summary(regions: list[dict], ind: dict) -> dict:
    def s(arr):
        f = arr[np.isfinite(arr)]
        return {"mean": float(f.mean()), "min": float(f.min()), "max": float(f.max()), "std": float(f.std()), "p10": float(np.percentile(f, 10)), "p90": float(np.percentile(f, 90))} if f.size else None

    lulc = ind["lulc"]
    total = max(int((lulc > 0).sum()), 1)
    return {
        "indicators": {k: s(ind[k]) for k in ("lst", "ndvi", "ndbi", "ndwi", "albedo")},
        "lulc_distribution": [{"class_id": c, "label": indices.LULC_CLASSES[c], "fraction": round(int((lulc == c).sum()) / total, 4),
                               "mean_lst": float(np.nanmean(ind["lst"][lulc == c])) if (lulc == c).any() else None} for c in range(1, 9)],
        "n_regions": len(regions),
        "vegetation_coverage_pct": round(100 * float(np.mean([(r["vegetation_fraction"] or 0) for r in regions])), 2),
        "total_population": int(sum((r["population"] or 0) for r in regions)),
    }


def extract_features(run_id: str) -> dict:
    t0 = time.time()
    with run_store.run_lock(run_id):
        pre_path = run_store.require_file(run_id, "preprocessed.npz", "/data/preprocess")
        pre = dict(np.load(pre_path))
        grid = AnalysisGrid.from_dict(run_store.read_json(run_id, "grid.json"))
        ind, qa = compute_indicators(pre)
        np.savez_compressed(run_store.run_dir(run_id) / "features.npz", **ind)
        regions = aggregate_regions(ind, pre, grid)
        run_store.write_json(run_id, "regions.json", regions)
        layers = render_layers(run_id, ind, grid)
        summary = city_summary(regions, ind)
        summary["quality"] = qa
        summary["elapsed_seconds"] = round(time.time() - t0, 2)
        run_store.write_json(run_id, "features_summary.json", summary)
    log.info("Extracted features for %d regions in %.1fs", len(regions), time.time() - t0)
    return {"run_id": run_id, "summary": summary, "layers": layers, "regions": regions}
