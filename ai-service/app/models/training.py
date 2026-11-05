"""Random Forest and XGBoost training, evaluation (spatial hold-out + spatial CV) and persistence."""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score, mean_absolute_error, mean_squared_error,
                             precision_recall_fscore_support, r2_score)
from sklearn.model_selection import GroupKFold, GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier, XGBRegressor

from app.config import RANDOM_SEED
from app.models.features import FEATURE_LABELS, SEVERITY_CLASSES, classify_severity, select_features, severity_thresholds
from app.utils import run_store
from app.utils.errors import ServiceError

log = logging.getLogger(__name__)
MODEL_FILE = "models.joblib"
BLOCK_CELLS = 4  # spatial blocks of 4x4 analysis cells (2 km) keep neighbouring cells in the same split


def load_region_frame(run_id: str) -> pd.DataFrame:
    regions = run_store.read_json(run_id, "regions.json", "/features/extract")
    df = pd.DataFrame(regions)
    df["block"] = (df["row"] // BLOCK_CELLS) * 1000 + (df["col"] // BLOCK_CELLS)
    return df


def _make_models(params: dict) -> dict:
    n_est = int(params.get("n_estimators", 200))
    depth = params.get("max_depth")
    rf_depth = int(depth) if depth else 10
    xgb_depth = int(depth) if depth else 5
    lr = float(params.get("learning_rate", 0.06))
    imp = lambda: SimpleImputer(strategy="median")  # noqa: E731
    return {
        "random_forest": {
            "classification": Pipeline([("imputer", imp()), ("model", RandomForestClassifier(n_estimators=n_est, max_depth=rf_depth, min_samples_leaf=3, class_weight="balanced", n_jobs=-1, random_state=RANDOM_SEED))]),
            "regression": Pipeline([("imputer", imp()), ("model", RandomForestRegressor(n_estimators=n_est, max_depth=rf_depth, min_samples_leaf=3, n_jobs=-1, random_state=RANDOM_SEED))]),
        },
        "xgboost": {
            "classification": Pipeline([("imputer", imp()), ("model", XGBClassifier(n_estimators=int(n_est * 1.5), max_depth=xgb_depth, learning_rate=lr, subsample=0.85, colsample_bytree=0.85, objective="multi:softprob", eval_metric="mlogloss", tree_method="hist", n_jobs=4, random_state=RANDOM_SEED))]),
            "regression": Pipeline([("imputer", imp()), ("model", XGBRegressor(n_estimators=int(n_est * 1.5), max_depth=xgb_depth, learning_rate=lr, subsample=0.85, colsample_bytree=0.85, tree_method="hist", n_jobs=4, random_state=RANDOM_SEED))]),
        },
    }


def _fit(pipe: Pipeline, X, y, task: str):
    if task == "classification":
        pipe.fit(X, y, model__sample_weight=compute_sample_weight("balanced", y))
    else:
        pipe.fit(X, y)
    return pipe


def _spatial_split(df: pd.DataFrame, y_cls: np.ndarray, test_size: float):
    """Group split by spatial block; retry seeds until every class is in both sets."""
    for seed in range(RANDOM_SEED, RANDOM_SEED + 50):
        gss = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
        tr, te = next(gss.split(df, y_cls, groups=df["block"]))
        if len(set(y_cls[tr])) == len(set(y_cls)) and len(set(y_cls[te])) == len(set(y_cls)):
            return tr, te, seed
    raise ServiceError("Could not create a spatial train/test split containing all severity classes")


def _cls_metrics(y_true, y_pred) -> dict:
    labels = list(range(len(SEVERITY_CLASSES)))
    p, r, f, s = precision_recall_fscore_support(y_true, y_pred, labels=labels, zero_division=0)
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(np.average(p, weights=None)),
        "recall": float(np.average(r)),
        "f1": float(f1_score(y_true, y_pred, average="macro", labels=labels, zero_division=0)),
        "f1_weighted": float(f1_score(y_true, y_pred, average="weighted", labels=labels, zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
        "per_class": [{"class": SEVERITY_CLASSES[i], "precision": float(p[i]), "recall": float(r[i]), "f1": float(f[i]), "support": int(s[i])} for i in labels],
    }


def _reg_metrics(y_true, y_pred) -> dict:
    return {"mae": float(mean_absolute_error(y_true, y_pred)), "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))), "r2": float(r2_score(y_true, y_pred))}


def _importance(pipe: Pipeline, features: list[str]) -> list[dict]:
    imp = np.asarray(pipe.named_steps["model"].feature_importances_, dtype=float)
    imp = imp / imp.sum() if imp.sum() > 0 else imp
    order = np.argsort(-imp)
    return [{"feature": features[i], "label": FEATURE_LABELS.get(features[i], features[i]), "importance": float(imp[i])} for i in order]


def train(run_id: str, params: dict | None = None) -> dict:
    params = params or {}
    test_size = float(params.get("test_size", 0.25))
    if not 0.1 <= test_size <= 0.5:
        raise ServiceError("test_size must be between 0.1 and 0.5")
    t_start = time.time()
    with run_store.run_lock(run_id):
        df = load_region_frame(run_id)
        lab = df[df["label_quality_ok"]].reset_index(drop=True)
        if len(lab) < 80:
            raise ServiceError(f"Only {len(lab)} regions have reliable LST labels; at least 80 are required")
        features = select_features(lab)
        thr = severity_thresholds(lab["lst_mean"].values)
        y_cls = classify_severity(lab["lst_mean"].values, thr)
        y_reg = lab["lst_mean"].values.astype(float)
        X = lab[features].astype(float)
        tr, te, split_seed = _spatial_split(lab, y_cls, test_size)
        models = _make_models(params)
        evaluation = {"run_id": run_id, "features": features, "feature_labels": {f: FEATURE_LABELS[f] for f in features},
                      "severity_thresholds": thr, "classes": SEVERITY_CLASSES, "n_labelled_regions": int(len(lab)),
                      "train_samples": int(len(tr)), "test_samples": int(len(te)),
                      "split": {"method": f"GroupShuffleSplit on {BLOCK_CELLS}x{BLOCK_CELLS}-cell spatial blocks", "test_size": test_size, "seed": split_seed},
                      "class_distribution": {SEVERITY_CLASSES[i]: int((y_cls == i).sum()) for i in range(4)},
                      "leakage_controls": ["LST excluded from inputs (it defines the labels)", "spatial block hold-out instead of random split",
                                           "imputer fitted inside each training pipeline only", "thresholds are a fixed labelling rule, not learned parameters"],
                      "models": {}, "trained_at": datetime.now(timezone.utc).isoformat(), "params": params}
        gkf = GroupKFold(n_splits=5)
        for name, tasks in models.items():
            res = {}
            for task, pipe in tasks.items():
                y = y_cls if task == "classification" else y_reg
                t0 = time.time()
                _fit(pipe, X.iloc[tr], y[tr], task)
                fit_s = time.time() - t0
                pred_te, pred_tr = pipe.predict(X.iloc[te]), pipe.predict(X.iloc[tr])
                if task == "classification":
                    m = _cls_metrics(y[te], pred_te)
                    m["train_accuracy"] = float(accuracy_score(y[tr], pred_tr))
                else:
                    m = _reg_metrics(y[te], pred_te)
                    m["train_r2"] = float(r2_score(y[tr], pred_tr))
                cv_scores = []
                for ctr, cte in gkf.split(X, y, groups=lab["block"]):
                    if task == "classification" and len(set(y[ctr])) < len(SEVERITY_CLASSES):
                        continue  # fold lacks a class (XGBoost requires contiguous labels)
                    cp = _make_models(params)[name][task]
                    _fit(cp, X.iloc[ctr], y[ctr], task)
                    pr = cp.predict(X.iloc[cte])
                    cv_scores.append(f1_score(y[cte], pr, average="macro", zero_division=0) if task == "classification" else r2_score(y[cte], pr))
                m["cv_metric"] = "macro F1" if task == "classification" else "R²"
                m["cv_mean"], m["cv_std"] = float(np.mean(cv_scores)), float(np.std(cv_scores))
                m["training_seconds"] = round(fit_s, 3)
                m["feature_importance"] = _importance(pipe, features)
                if task == "regression":
                    sample = np.linspace(0, len(te) - 1, min(len(te), 250)).astype(int)
                    m["scatter"] = [{"observed": float(y[te][i]), "predicted": float(pred_te[i])} for i in sample]
                res[task] = m
                # refit on all labelled data for deployment (evaluation numbers stay from the hold-out)
                _fit(pipe, X, y, task)
            evaluation["models"][name] = res
        best_cls = max(evaluation["models"], key=lambda k: evaluation["models"][k]["classification"]["f1"])
        best_reg = max(evaluation["models"], key=lambda k: evaluation["models"][k]["regression"]["r2"])
        evaluation["best_model"] = {"classification": best_cls, "regression": best_reg}
        evaluation["total_seconds"] = round(time.time() - t_start, 2)
        bundle = {"models": models, "features": features, "thresholds": thr, "classes": SEVERITY_CLASSES, "run_id": run_id,
                  "best_model": evaluation["best_model"], "train_medians": X.median().to_dict()}
        joblib.dump(bundle, run_store.run_dir(run_id) / MODEL_FILE)
        run_store.write_json(run_id, "evaluation.json", evaluation)
    log.info("Trained models for %s in %.1fs (best cls=%s, best reg=%s)", run_id, evaluation["total_seconds"], best_cls, best_reg)
    return evaluation


def load_bundle(run_id: str | None) -> dict:
    rid = run_id or run_store.latest_run_with(MODEL_FILE)
    if not rid:
        raise ServiceError("No trained models available. Run /model/train first.", 409)
    path = run_store.require_file(rid, MODEL_FILE, "/model/train")
    return joblib.load(path)
