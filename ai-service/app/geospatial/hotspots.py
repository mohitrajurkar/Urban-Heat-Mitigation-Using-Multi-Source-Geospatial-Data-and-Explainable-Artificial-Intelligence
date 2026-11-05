"""Hotspot detection: documented severity thresholds, model predictions and Getis-Ord Gi* statistics."""
from __future__ import annotations

import logging

import numpy as np
from scipy.ndimage import convolve

from app.models.features import SEVERITY_CLASSES, classify_severity
from app.models.training import load_bundle, load_region_frame
from app.utils import run_store

log = logging.getLogger(__name__)
HOTSPOT_CLASSES = ("High", "Very High")


def getis_ord_gi_star(values: np.ndarray) -> np.ndarray:
    """Gi* z-scores on a 2-D grid with binary queen-contiguity weights including the cell itself."""
    v = np.asarray(values, dtype=float)
    valid = np.isfinite(v)
    n = int(valid.sum())
    if n < 3:
        return np.full(v.shape, np.nan)
    x = np.where(valid, v, 0.0)
    kernel = np.ones((3, 3))
    xbar = x[valid].mean()
    s = np.sqrt((x[valid] ** 2).mean() - xbar**2)
    wsum = convolve(valid.astype(float), kernel, mode="constant", cval=0.0)
    wx = convolve(x, kernel, mode="constant", cval=0.0)
    denom = s * np.sqrt(np.maximum(n * wsum - wsum**2, 1e-12) / (n - 1))
    z = (wx - xbar * wsum) / np.where(denom > 0, denom, np.nan)
    z[~valid] = np.nan
    return z


def detect(run_id: str) -> dict:
    df = load_region_frame(run_id)
    preds = {p["cell_index"]: p for p in run_store.read_json(run_id, "predictions.json", "/model/predict")}
    bundle = load_bundle(run_id)
    thr = bundle["thresholds"]
    grid = run_store.read_json(run_id, "grid.json")
    n_r, n_c = grid["n_rows_cells"], grid["n_cols_cells"]

    obs = np.array([r if ok else np.nan for r, ok in zip(df["lst_mean"].astype(float), df["label_quality_ok"])])
    pred_lst = np.array([preds[int(c)]["predicted_lst"] for c in df["cell_index"]])
    final_lst = np.where(np.isfinite(obs), obs, pred_lst)
    obs_cls = classify_severity(obs, thr)
    lst_grid = np.full((n_r, n_c), np.nan)
    lst_grid[df["row"].values, df["col"].values] = final_lst
    gi = getis_ord_gi_star(lst_grid)[df["row"].values, df["col"].values]
    city_mean = float(np.nanmean(final_lst))

    records = []
    for i, row in df.iterrows():
        p = preds[int(row["cell_index"])]
        observed = SEVERITY_CLASSES[obs_cls[i]] if obs_cls[i] >= 0 else None
        severity = observed or p["predicted_class"]
        records.append({
            "cell_index": int(row["cell_index"]),
            "region_code": row["region_code"],
            "name": row["name"],
            "locality": row["locality"],
            "centroid": row["centroid"],
            "severity": severity,
            "severity_source": "observed LST thresholds" if observed else "model prediction (LST not observable)",
            "observed_severity": observed,
            "predicted_severity": p["predicted_class"],
            "models_agree": observed is None or observed == p["predicted_class"],
            "lst": float(final_lst[i]),
            "lst_anomaly": float(final_lst[i] - city_mean),
            "gi_star_z": None if not np.isfinite(gi[i]) else float(gi[i]),
            "gi_star_significant": bool(np.isfinite(gi[i]) and gi[i] >= 1.96),
            "is_hotspot": severity in HOTSPOT_CLASSES,
        })
    hot = [r for r in records if r["is_hotspot"]]
    summary = {
        "thresholds": thr,
        "city_mean_lst": city_mean,
        "severity_counts": {c: sum(1 for r in records if r["severity"] == c) for c in SEVERITY_CLASSES},
        "n_hotspots": len(hot),
        "n_significant_gi_star": sum(1 for r in hot if r["gi_star_significant"]),
        "method": "Severity from μ/σ thresholds on observed cell-mean LST (model prediction where LST is missing); "
                  "spatial clustering by Getis-Ord Gi* (3x3 queen contiguity, z ≥ 1.96 ⇒ significant at 95 %).",
    }
    run_store.write_json(run_id, "hotspots.json", {"summary": summary, "regions": records})
    log.info("Detected %d hotspots for %s", len(hot), run_id)
    return {"run_id": run_id, "summary": summary, "hotspots": hot, "all_regions": records}
