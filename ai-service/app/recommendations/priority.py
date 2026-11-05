"""Transparent hotspot priority scoring (0-100) from five normalised components."""
from __future__ import annotations

import numpy as np

from app.preprocessing.cleaning import minmax_normalize, percentile_rank

COMPONENTS = ("heat_severity", "population_vulnerability", "vegetation_deficit", "implementation_feasibility", "cooling_benefit")


def priority_level(score: float, levels: list[dict]) -> str:
    for lvl in sorted(levels, key=lambda x: -x["min_score"]):
        if score >= lvl["min_score"]:
            return lvl["level"]
    return levels[-1]["level"]


def combined_cooling(recs: list[dict]) -> float:
    """Diminishing-returns combination of the three most effective interventions (cap 5 °C)."""
    best = sorted((r["cooling_c"] for r in recs), reverse=True)[:3]
    total = sum(c * w for c, w in zip(best, (1.0, 0.6, 0.35)))
    return float(min(total, 5.0))


def score_regions(hotspots: list[dict], regions: dict, recs_by_cell: dict, cfg: dict) -> list[dict]:
    weights = cfg["priority_weights"]
    wsum = sum(weights.values()) or 1.0
    weights = {k: v / wsum for k, v in weights.items()}
    hot = [h for h in hotspots if h["is_hotspot"]]
    if not hot:
        return []
    lst_all = np.array([h["lst"] for h in hotspots])
    lst_norm = dict(zip([h["cell_index"] for h in hotspots], minmax_normalize(lst_all)))
    pop = np.array([regions[h["cell_index"]].get("population_density") or np.nan for h in hotspots], dtype=float)
    built = np.array([regions[h["cell_index"]].get("built_fraction") or 0 for h in hotspots], dtype=float)
    vuln_src = pop if np.isfinite(pop).sum() > len(pop) * 0.5 else built
    vuln = dict(zip([h["cell_index"] for h in hotspots], np.nan_to_num(percentile_rank(vuln_src), nan=0.0)))
    ndvi = np.array([regions[h["cell_index"]].get("ndvi_mean") if regions[h["cell_index"]].get("ndvi_mean") is not None else np.nan for h in hotspots], dtype=float)
    veg_def = dict(zip([h["cell_index"] for h in hotspots], np.nan_to_num(minmax_normalize(ndvi, invert=True), nan=0.5)))
    cool = {h["cell_index"]: combined_cooling(recs_by_cell.get(h["cell_index"], [])) for h in hot}
    max_cool = max(cool.values()) or 1.0

    out = []
    for h in hot:
        c = h["cell_index"]
        reg = regions[c]
        recs = recs_by_cell.get(c, [])
        open_f = reg.get("open_land_fraction") or 0.0
        feas = float(np.clip(0.5 * min(open_f / 0.3, 1.0) + 0.5 * len(recs) / 5.0, 0, 1))
        comp = {
            "heat_severity": float(lst_norm[c]),
            "population_vulnerability": float(vuln[c]),
            "vegetation_deficit": float(veg_def[c]),
            "implementation_feasibility": feas,
            "cooling_benefit": float(cool[c] / max_cool),
        }
        score = 100 * sum(weights[k] * comp[k] for k in COMPONENTS)
        out.append({
            "cell_index": c, "region_code": h["region_code"], "name": h["name"], "locality": h["locality"], "severity": h["severity"],
            "lst": h["lst"], "score": round(score, 2), "components": comp, "weights": weights,
            "contributions": {k: round(100 * weights[k] * comp[k], 2) for k in COMPONENTS},
            "expected_cooling_c": cool[c], "n_interventions": len(recs),
            "estimated_cost_inr": float(sum(r["cost_inr"] for r in recs)),
            "population": reg.get("population"),
        })
    out.sort(key=lambda r: -r["score"])
    for i, r in enumerate(out, start=1):
        r["rank"] = i
        r["priority_level"] = priority_level(r["score"], cfg["priority_levels"])
    return out
