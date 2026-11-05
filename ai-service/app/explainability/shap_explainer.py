"""SHAP explainability: global importance, summary plots, local explanations and narratives.

Every explanation below is derived from TreeSHAP values computed on the trained models.
The narrative text is assembled from the sign/magnitude of those values; nothing is hardcoded.
"""
from __future__ import annotations

import logging
import time

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import shap  # noqa: E402

from app.models.features import FEATURE_LABELS, FEATURE_PHRASES, SEVERITY_CLASSES  # noqa: E402
from app.models.prediction import predict_custom  # noqa: E402
from app.models.training import load_bundle, load_region_frame  # noqa: E402
from app.utils import run_store  # noqa: E402
from app.utils.errors import ServiceError  # noqa: E402

log = logging.getLogger(__name__)
LOCAL_EXPLAINER = "xgboost"
# expected sign of each feature's effect on LST when its value is high (None = no single physical direction)
HEAT_DIRECTION = {"ndvi_mean": -1, "ndbi_mean": 1, "ndwi_mean": None, "albedo_mean": -1, "built_fraction": 1, "vegetation_fraction": -1,
                  "water_fraction": -1, "open_land_fraction": 1, "air_temp_max": 1, "relative_humidity": -1, "wind_speed": -1,
                  "population_density": 1, "road_density": 1}
RF_GLOBAL_SAMPLE = 400


def _explain(pipe, X: pd.DataFrame):
    Xi = pd.DataFrame(pipe.named_steps["imputer"].transform(X), columns=X.columns)
    explainer = shap.TreeExplainer(pipe.named_steps["model"])
    values = np.asarray(explainer.shap_values(Xi, check_additivity=False))
    base = np.asarray(explainer.expected_value, dtype=float)
    if values.ndim == 3 and values.shape[0] == len(SEVERITY_CLASSES) and values.shape[1] == len(Xi):
        values = np.transpose(values, (1, 2, 0))  # legacy list-of-classes layout -> (n, f, k)
    return Xi, values, base


def _fmt_value(feature: str, v: float) -> str:
    if feature.endswith("_fraction"):
        return f"{100 * v:.0f}%"
    if feature == "population_density":
        return f"{v:,.0f}/km²"
    if feature in ("air_temp_max",):
        return f"{v:.1f} °C"
    if feature == "relative_humidity":
        return f"{v:.0f}%"
    if feature == "wind_speed":
        return f"{v:.1f} m/s"
    if feature == "road_density":
        return f"{v:.1f} km/km²"
    return f"{v:.3f}"


def narrative(name: str, pred_class: str, pred_lst: float, base: float, contribs: list[dict], pct: dict) -> str:
    """Build a sentence from SHAP contributions (°C) sorted by magnitude."""
    def phrase(c):
        f = c["feature"]
        is_high = pct.get(f, 0.5) >= 0.5
        expected = HEAT_DIRECTION.get(f)
        value_txt = f"{c['label']} {_fmt_value(f, c['value'])}, {c['shap']:+.1f} °C"
        # descriptive wording only when the SHAP sign matches the physically expected direction;
        # otherwise (non-linear effects) state the value neutrally to avoid contradictory prose
        if expected is not None and (c["shap"] > 0) == ((expected > 0) == is_high):
            low, high = FEATURE_PHRASES.get(f, ("low " + c["label"], "high " + c["label"]))
            return f"{high if is_high else low} ({value_txt})"
        rel = "above" if is_high else "below"
        return f"{c['label'].split(' (')[0].lower()} {rel} the city median ({value_txt})"

    pos = [c for c in contribs if c["shap"] > 0.05][:3]
    neg = [c for c in contribs if c["shap"] < -0.05][:2]
    diff = pred_lst - base
    text = (f"{name} is predicted to have {pred_class} heat severity with an estimated LST of {pred_lst:.1f} °C, "
            f"{abs(diff):.1f} °C {'above' if diff >= 0 else 'below'} the study-area model baseline of {base:.1f} °C.")
    if pos:
        text += " Heat is driven mainly by " + _join([phrase(c) for c in pos]) + "."
    if neg:
        text += " These effects are partly offset by " + _join([phrase(c) for c in neg]) + "."
    if not pos and not neg:
        text += " No single factor dominates; the prediction stays close to the baseline."
    return text


def _join(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def _contrib_list(features, xrow, srow, raw_row=None) -> list[dict]:
    items = []
    for j, f in enumerate(features):
        val = float(xrow[j])
        items.append({"feature": f, "label": FEATURE_LABELS.get(f, f), "value": val, "shap": float(srow[j]),
                      "imputed": bool(raw_row is not None and not np.isfinite(raw_row[j]))})
    return sorted(items, key=lambda c: -abs(c["shap"]))


def _summary_plot(path, values, Xi, title, kind="dot"):
    plt.figure()
    shap.summary_plot(values, Xi.rename(columns=FEATURE_LABELS), show=False, plot_type=kind, plot_size=(9, 5.5), color_bar=kind == "dot")
    plt.title(title, fontsize=11)
    plt.tight_layout()
    plt.savefig(path, dpi=130, bbox_inches="tight")
    plt.close("all")


def explain_run(run_id: str) -> dict:
    t0 = time.time()
    bundle = load_bundle(run_id)
    if bundle["run_id"] != run_id:
        raise ServiceError("Models for this run are missing. Run /model/train first.", 409)
    preds = {p["cell_index"]: p for p in run_store.read_json(run_id, "predictions.json", "/model/predict")}
    df = load_region_frame(run_id)
    feats = bundle["features"]
    X = df[feats].astype(float)
    plot_dir = run_store.run_dir(run_id) / "plots"
    plot_dir.mkdir(exist_ok=True)
    pct = X.rank(pct=True)

    global_out, shap_cache = {}, {}
    pred_cls_idx = {name: np.array([SEVERITY_CLASSES.index(preds[int(c)]["models"][name]["predicted_class"]) for c in df["cell_index"]])
                    for name in bundle["models"]}
    for name, tasks in bundle["models"].items():
        global_out[name] = {}
        # exact TreeSHAP for a deep Random Forest costs O(trees x leaves x depth^2) per row, so the RF global
        # summary uses an evenly spaced sample; XGBoost (fast exact TreeSHAP) is explained on every region.
        rows = np.arange(len(X)) if name == LOCAL_EXPLAINER else np.linspace(0, len(X) - 1, min(RF_GLOBAL_SAMPLE, len(X))).astype(int)
        for task in ("regression", "classification"):
            ts = time.time()
            Xi, vals, base = _explain(tasks[task], X.iloc[rows])
            log.info("SHAP %s/%s on %d rows: %.1fs", name, task, len(rows), time.time() - ts)
            shap_cache[(name, task)] = (Xi, vals, base)
            if task == "regression":
                mean_abs = np.abs(vals).mean(axis=0)
                plot_vals = vals
            else:
                mean_abs = np.abs(vals).mean(axis=(0, 2))
                plot_vals = [vals[:, :, k] for k in range(vals.shape[2])]
            order = np.argsort(-mean_abs)
            imp = [{"feature": feats[j], "label": FEATURE_LABELS[feats[j]], "mean_abs_shap": float(mean_abs[j])} for j in order]
            # beeswarm data: SHAP value vs normalised feature value for up to 300 regions
            sample = np.linspace(0, len(Xi) - 1, min(300, len(Xi))).astype(int)
            sv = vals if task == "regression" else vals[np.arange(len(vals)), :, pred_cls_idx[name][rows]]
            norm = ((Xi - Xi.min()) / (Xi.max() - Xi.min()).replace(0, 1)).to_numpy()
            beeswarm = [{"feature": feats[j], "label": FEATURE_LABELS[feats[j]],
                         "points": [{"shap": round(float(sv[i, j]), 4), "value": round(float(norm[i, j]), 3)} for i in sample]} for j in order]
            png = f"summary_{name}_{task}.png"
            title = f"SHAP summary - {name.replace('_', ' ').title()} ({'LST °C' if task == 'regression' else 'severity class'})"
            _summary_plot(plot_dir / png, plot_vals, Xi, title, "dot" if task == "regression" else "bar")
            global_out[name][task] = {"importance": imp, "beeswarm": beeswarm, "plot": png, "n_explained": int(len(rows)),
                                      "base_value": base.tolist() if base.ndim else float(base),
                                      "unit": "°C (LST)" if task == "regression" else "model output (per-class log-odds / probability)"}

    # local explanations: XGBoost TreeSHAP for every region (regression in °C + contributions toward the predicted class)
    best_r = best_c = LOCAL_EXPLAINER
    Xi_r, vals_r, base_r = shap_cache[(best_r, "regression")]
    Xi_c, vals_c, base_c = shap_cache[(best_c, "classification")]
    local = []
    for i, row in df.iterrows():
        k = int(pred_cls_idx[best_c][i])
        contribs = _contrib_list(feats, Xi_r.iloc[i].values, vals_r[i], X.iloc[i].values)
        cls_contribs = _contrib_list(feats, Xi_c.iloc[i].values, vals_c[i, :, k])
        pred_lst = float(base_r) + float(vals_r[i].sum())
        local.append({
            "cell_index": int(row["cell_index"]),
            "region_code": row["region_code"],
            "model": best_r,
            "classifier": best_c,
            "base_value": float(base_r),
            "predicted_value": pred_lst,
            "predicted_class": SEVERITY_CLASSES[k],
            "contributions": contribs,
            "class_contributions": cls_contribs[:6],
            "positive_factors": [c for c in contribs if c["shap"] > 0][:5],
            "negative_factors": [c for c in contribs if c["shap"] < 0][:5],
            "explanation": narrative(row["name"], SEVERITY_CLASSES[k], pred_lst, float(base_r), contribs, pct.iloc[i].to_dict()),
        })
    out = {"run_id": run_id, "global": global_out, "best_model": bundle["best_model"], "local_explainer": LOCAL_EXPLAINER,
           "rf_global_sample": RF_GLOBAL_SAMPLE, "n_local": len(local), "elapsed_seconds": round(time.time() - t0, 2)}
    run_store.write_json(run_id, "shap_global.json", out)
    run_store.write_json(run_id, "shap_local.json", local)
    log.info("SHAP explanations for %s computed in %.1fs", run_id, out["elapsed_seconds"])
    return {**out, "local": local}


def explain_custom(samples: list[dict], run_id: str | None = None) -> list[dict]:
    res = predict_custom(samples, run_id)
    bundle = load_bundle(res["run_id"])
    X = res.pop("X")
    best_r = best_c = LOCAL_EXPLAINER
    Xi, vals, base = _explain(bundle["models"][best_r]["regression"], X)
    Xc, vals_c, _ = _explain(bundle["models"][best_c]["classification"], X)
    ref = load_region_frame(bundle["run_id"])[bundle["features"]].astype(float)
    out = []
    for i in range(len(X)):
        pct = {f: float((ref[f] <= Xi.iloc[i][f]).mean()) for f in bundle["features"]}
        contribs = _contrib_list(bundle["features"], Xi.iloc[i].values, vals[i], X.iloc[i].values)
        r = res["results"][i]
        cls = r["models"][best_c]["predicted_class"]
        k = SEVERITY_CLASSES.index(cls)
        pred = float(base) + float(vals[i].sum())
        out.append({**r, "best_model": bundle["best_model"], "explainer_model": LOCAL_EXPLAINER, "base_value": float(base), "predicted_value": pred, "predicted_class": cls,
                    "contributions": contribs, "class_contributions": _contrib_list(bundle["features"], Xc.iloc[i].values, vals_c[i, :, k])[:6],
                    "explanation": narrative("The specified location", cls, pred, float(base), contribs, pct)})
    return out
