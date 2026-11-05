"""Mitigation recommendation engine with transparent cost and cooling estimation.

All estimates are APPROXIMATE and driven by strategies.json (overridable per request).
"""
from __future__ import annotations

import copy
import json
import logging
from pathlib import Path

import numpy as np

from app.features.indices import BUILT_CLASSES, OPEN_CLASSES
from app.geospatial.grid import AnalysisGrid
from app.models.training import load_region_frame
from app.recommendations.priority import score_regions
from app.utils import run_store

log = logging.getLogger(__name__)
CONFIG_PATH = Path(__file__).with_name("strategies.json")


def load_config(overrides: dict | None = None) -> dict:
    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if overrides:
        cfg = copy.deepcopy(cfg)
        for key, val in overrides.get("strategies", {}).items():
            if key in cfg["strategies"] and isinstance(val, dict):
                cfg["strategies"][key].update({k: v for k, v in val.items() if isinstance(v, (int, float))})
        if overrides.get("priority_weights"):
            cfg["priority_weights"].update(overrides["priority_weights"])
    return cfg


def _cooling(area_m2: float, cell_m2: float, s: dict) -> float:
    return float(min(s["max_cooling_c"], s["cooling_coefficient_c"] * area_m2 / cell_m2))


def _best_pixel(run_id: str, features: dict, grid: AnalysisGrid, row: int, col: int, classes: tuple | None, prefer_low_albedo=False):
    """Hottest suitable pixel within the cell -> recommended location (lon, lat)."""
    k = grid.cell_px
    r0, c0 = row * k, col * k
    lst = features["lst"][r0:r0 + k, c0:c0 + k]
    lulc = features["lulc"][r0:r0 + k, c0:c0 + k]
    score = np.where(np.isfinite(lst), lst, -np.inf)
    if prefer_low_albedo:
        alb = features["albedo"][r0:r0 + k, c0:c0 + k]
        score = score - 10 * np.nan_to_num(alb, nan=1.0)
    if classes:
        mask = np.isin(lulc, classes)
        if mask.any():
            score = np.where(mask, score, -np.inf)
    if not np.isfinite(score).any():
        return grid.pixel_to_lonlat(r0 + k / 2 - 0.5, c0 + k / 2 - 0.5)
    rr, cc = np.unravel_index(int(np.argmax(score)), score.shape)
    return grid.pixel_to_lonlat(r0 + rr, c0 + cc)


def recommend_for_region(reg: dict, cfg: dict, cell_m2: float) -> list[dict]:
    st = cfg["strategies"]
    out = []
    built = reg.get("built_fraction") or 0.0
    open_f = reg.get("open_land_fraction") or 0.0
    ndvi = reg.get("ndvi_mean")
    ndvi = 0.2 if ndvi is None else ndvi
    albedo = reg.get("albedo_mean") or 0.2
    ndbi = reg.get("ndbi_mean") or 0.0
    ndwi = reg.get("ndwi_mean") or 0.0
    water = reg.get("water_fraction") or 0.0
    road = reg.get("road_density")

    s = st["tree_plantation"]
    area = cell_m2 * (s["share_of_built_area"] * built + s["share_of_open_area"] * open_f)
    if ndvi < s["max_ndvi"] and built >= s["min_built_fraction"] and area >= s["min_area_m2"]:
        trees = int(area // s["spacing_m2_per_tree"])
        out.append({"type": "tree_plantation", "area_m2": area, "quantity": trees, "unit": "trees", "cost_inr": trees * s["unit_cost_inr"],
                    "suitability": float(np.clip((s["max_ndvi"] - ndvi) / s["max_ndvi"], 0, 1)),
                    "reason": f"NDVI {ndvi:.2f} is below the {s['max_ndvi']:.2f} threshold; {100 * built:.0f}% built-up and {100 * open_f:.0f}% open land leave about {area / 1e4:.2f} ha for street and setback planting.",
                    "location_classes": BUILT_CLASSES + OPEN_CLASSES})

    s = st["urban_forest"]
    area = min(cell_m2 * open_f * s["share_of_open_area"], s["max_area_m2"])
    if open_f >= s["min_open_fraction"] and built >= s["min_built_fraction"] and area >= s["min_area_m2"]:
        out.append({"type": "urban_forest", "area_m2": area, "quantity": round(area), "unit": "m²", "cost_inr": area * s["unit_cost_inr"],
                    "suitability": float(np.clip(open_f / 0.4, 0, 1)),
                    "reason": f"{100 * open_f:.0f}% of the cell is barren or fallow land, enough for a {area / 1e4:.2f} ha dense native forest patch.",
                    "location_classes": OPEN_CLASSES})

    s = st["cool_roofs"]
    area = cell_m2 * built * s["roof_share_of_built"] * s["adoption_rate"]
    if built >= s["min_built_fraction"] and albedo < s["max_albedo"]:
        out.append({"type": "cool_roofs", "area_m2": area, "quantity": round(area), "unit": "m²", "cost_inr": area * s["unit_cost_inr"],
                    "suitability": float(np.clip(built * (s["max_albedo"] - albedo) / s["max_albedo"] * 2, 0, 1)),
                    "reason": f"{100 * built:.0f}% built-up with low surface albedo ({albedo:.2f} < {s['max_albedo']:.2f}); coating {100 * s['adoption_rate']:.0f}% of roofs covers ~{area / 1e4:.2f} ha.",
                    "location_classes": BUILT_CLASSES, "low_albedo": True})

    s = st["cool_pavements"]
    if road is not None and road > 0:
        paved_share = min(road * s["road_width_m"] / 1000.0, s["max_paved_share"])
        basis = f"road density {road:.1f} km/km² × {s['road_width_m']} m width"
    else:
        paved_share = built * s["paved_share_of_built_if_no_roads"]
        basis = f"{100 * s['paved_share_of_built_if_no_roads']:.0f}% of built-up area assumed paved"
    area = cell_m2 * paved_share * s["adoption_rate"]
    if built >= s["min_built_fraction"] and ndbi >= s["min_ndbi"] and area > 0:
        out.append({"type": "cool_pavements", "area_m2": area, "quantity": round(area), "unit": "m²", "cost_inr": area * s["unit_cost_inr"],
                    "suitability": float(np.clip(0.5 + ndbi * 2, 0, 1)),
                    "reason": f"NDBI {ndbi:.2f} indicates dense impervious surfaces; paved area estimated from {basis}, {100 * s['adoption_rate']:.0f}% treated.",
                    "location_classes": (7, 8, 6)})

    s = st["water_bodies"]
    area = min(cell_m2 * open_f * s["share_of_open_area"], s["max_area_m2"])
    if water <= s["max_water_fraction"] and ndwi <= s["max_ndwi"] and built >= s["min_built_fraction"] and open_f >= s["min_open_fraction"] and area >= s["min_area_m2"]:
        out.append({"type": "water_bodies", "area_m2": area, "quantity": round(area), "unit": "m²", "cost_inr": area * s["unit_cost_inr"],
                    "suitability": float(np.clip(-ndwi, 0, 1)),
                    "reason": f"No surface water in the cell (NDWI {ndwi:.2f}) and {100 * open_f:.0f}% open land allows a {area / 1e4:.2f} ha retention pond for evaporative cooling.",
                    "location_classes": OPEN_CLASSES})

    for rec in out:
        s = st[rec["type"]]
        rec["name"] = s["name"]
        rec["cooling_c"] = _cooling(rec["area_m2"], cell_m2, s)
        rec["cost_low_inr"] = rec["cost_inr"] * (1 - cfg["cost_uncertainty"])
        rec["cost_high_inr"] = rec["cost_inr"] * (1 + cfg["cost_uncertainty"])
        rec["cost_per_degree_inr"] = rec["cost_inr"] / rec["cooling_c"] if rec["cooling_c"] > 0 else None
        rec["unit_cost_inr"] = s["unit_cost_inr"]
        rec["unit_cost_basis"] = s["unit_cost_basis"]
        rec["description"] = s["description"]
    return out


def generate(run_id: str, overrides: dict | None = None) -> dict:
    cfg = load_config(overrides)
    hs = run_store.read_json(run_id, "hotspots.json", "/hotspots/detect")
    df = load_region_frame(run_id)
    regions = {int(r["cell_index"]): r for r in df.to_dict(orient="records")}
    grid = AnalysisGrid.from_dict(run_store.read_json(run_id, "grid.json"))
    features = dict(np.load(run_store.require_file(run_id, "features.npz", "/features/extract")))
    cell_m2 = grid.cell_area_km2 * 1e6

    recs_by_cell: dict[int, list[dict]] = {}
    for h in hs["regions"]:
        if not h["is_hotspot"]:
            continue
        reg = regions[h["cell_index"]]
        recs = recommend_for_region(reg, cfg, cell_m2)
        for r in recs:
            lon, lat = _best_pixel(run_id, features, grid, int(reg["row"]), int(reg["col"]), r.pop("location_classes"), r.pop("low_albedo", False))
            r.update({"cell_index": h["cell_index"], "region_code": h["region_code"], "region_name": h["name"], "locality": h["locality"],
                      "location": [round(lon, 6), round(lat, 6)],
                      "location_description": f"Hottest suitable 100 m pixel in {h['name']} ({lat:.4f}° N, {lon:.4f}° E)",
                      "approximate": True})
        recs_by_cell[h["cell_index"]] = recs

    rankings = score_regions(hs["regions"], regions, recs_by_cell, cfg)
    level_by_cell = {r["cell_index"]: r["priority_level"] for r in rankings}
    all_recs = []
    for cell, recs in recs_by_cell.items():
        for r in recs:
            r["priority_level"] = level_by_cell.get(cell, "Low")
            all_recs.append(r)
    all_recs.sort(key=lambda r: (r["cost_per_degree_inr"] or 1e18))
    for i, r in enumerate(all_recs, start=1):
        r["cost_effectiveness_rank"] = i

    by_type = {}
    for key, s in cfg["strategies"].items():
        sel = [r for r in all_recs if r["type"] == key]
        by_type[key] = {"name": s["name"], "count": len(sel), "total_cost_inr": float(sum(r["cost_inr"] for r in sel)),
                        "total_area_m2": float(sum(r["area_m2"] for r in sel)), "mean_cooling_c": float(np.mean([r["cooling_c"] for r in sel])) if sel else 0.0,
                        "unit_cost_inr": s["unit_cost_inr"], "unit": s["unit"],
                        "mean_cost_per_degree_inr": float(np.mean([r["cost_per_degree_inr"] for r in sel if r["cost_per_degree_inr"]])) if sel else None}
    summary = {"n_recommendations": len(all_recs), "n_regions": len(recs_by_cell), "total_cost_inr": float(sum(r["cost_inr"] for r in all_recs)),
               "by_type": by_type, "note": cfg["_note"], "priority_weights": cfg["priority_weights"]}
    payload = {"run_id": run_id, "summary": summary, "recommendations": all_recs, "rankings": rankings, "assumptions": cfg}
    run_store.write_json(run_id, "recommendations.json", payload)
    log.info("Generated %d recommendations for %d hotspot regions", len(all_recs), len(recs_by_cell))
    return payload
