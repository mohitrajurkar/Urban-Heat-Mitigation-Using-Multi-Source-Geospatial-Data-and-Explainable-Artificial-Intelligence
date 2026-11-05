"""Region and custom-input predictions with the trained Random Forest and XGBoost models."""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from app.models.features import SEVERITY_CLASSES, classify_severity
from app.models.training import load_bundle, load_region_frame
from app.utils import run_store
from app.utils.errors import ServiceError

log = logging.getLogger(__name__)


def _predict_frame(bundle: dict, X: pd.DataFrame) -> dict:
    out = {}
    for name, tasks in bundle["models"].items():
        proba = tasks["classification"].predict_proba(X)
        lst = tasks["regression"].predict(X)
        out[name] = {"proba": proba, "cls": proba.argmax(axis=1), "lst": lst}
    return out


def predict_run(run_id: str) -> dict:
    bundle = load_bundle(run_id)
    if bundle["run_id"] != run_id:
        raise ServiceError("Models for this run are missing. Run /model/train first.", 409)
    df = load_region_frame(run_id)
    X = df[bundle["features"]].astype(float)
    preds = _predict_frame(bundle, X)
    thr = bundle["thresholds"]
    observed_cls = classify_severity(df["lst_mean"].where(df["label_quality_ok"]).values.astype(float), thr)
    best_c, best_r = bundle["best_model"]["classification"], bundle["best_model"]["regression"]
    records = []
    for i, row in df.iterrows():
        rec = {
            "cell_index": int(row["cell_index"]),
            "region_code": row["region_code"],
            "observed_lst": row["lst_mean"] if row["label_quality_ok"] else None,
            "observed_class": SEVERITY_CLASSES[observed_cls[i]] if observed_cls[i] >= 0 else None,
            "best_classifier": best_c,
            "best_regressor": best_r,
            "predicted_class": SEVERITY_CLASSES[int(preds[best_c]["cls"][i])],
            "predicted_lst": float(preds[best_r]["lst"][i]),
            "models": {},
        }
        for name, p in preds.items():
            rec["models"][name] = {
                "predicted_class": SEVERITY_CLASSES[int(p["cls"][i])],
                "class_probabilities": {SEVERITY_CLASSES[k]: round(float(p["proba"][i, k]), 4) for k in range(len(SEVERITY_CLASSES))},
                "predicted_lst": round(float(p["lst"][i]), 3),
            }
        records.append(rec)
    labelled = [r for r in records if r["observed_class"]]
    agreement = {name: float(np.mean([r["models"][name]["predicted_class"] == r["observed_class"] for r in labelled])) for name in preds}
    summary = {
        "n_regions": len(records),
        "n_unlabelled_predicted": int(sum(1 for r in records if r["observed_class"] is None)),
        "predicted_class_counts": {c: int(sum(1 for r in records if r["predicted_class"] == c)) for c in SEVERITY_CLASSES},
        "in_sample_agreement_note": "Agreement over all labelled regions includes training data; see /model/evaluation for hold-out metrics.",
        "in_sample_agreement": agreement,
    }
    run_store.write_json(run_id, "predictions.json", records)
    log.info("Predicted %d regions for %s", len(records), run_id)
    return {"run_id": run_id, "summary": summary, "predictions": records}


def predict_custom(samples: list[dict], run_id: str | None = None) -> dict:
    bundle = load_bundle(run_id)
    feats = bundle["features"]
    rows = []
    for s in samples:
        rows.append({f: (float(s[f]) if s.get(f) is not None else np.nan) for f in feats})
    X = pd.DataFrame(rows, columns=feats)
    missing = [f for f in feats if X[f].isna().all()]
    preds = _predict_frame(bundle, X)
    results = []
    for i in range(len(X)):
        results.append({
            "input": {f: (None if np.isnan(X.iloc[i][f]) else float(X.iloc[i][f])) for f in feats},
            "models": {name: {"predicted_class": SEVERITY_CLASSES[int(p["cls"][i])],
                              "class_probabilities": {SEVERITY_CLASSES[k]: round(float(p["proba"][i, k]), 4) for k in range(4)},
                              "predicted_lst": round(float(p["lst"][i]), 3)} for name, p in preds.items()},
        })
    return {"run_id": bundle["run_id"], "features": feats, "imputed_features": missing, "results": results, "X": X}
