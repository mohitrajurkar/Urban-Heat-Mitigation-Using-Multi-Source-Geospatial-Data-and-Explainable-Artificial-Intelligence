"""Feature definitions and heat-severity labelling shared by training, prediction and SHAP."""
from __future__ import annotations

import numpy as np
import pandas as pd

# LST is deliberately NOT a model input: it defines the target (severity class / regression
# target), so using it as a feature would leak the label into the inputs.
CANDIDATE_FEATURES = [
    "ndvi_mean",
    "ndbi_mean",
    "ndwi_mean",
    "albedo_mean",
    "built_fraction",
    "vegetation_fraction",
    "water_fraction",
    "open_land_fraction",
    "air_temp_max",
    "relative_humidity",
    "wind_speed",
    "population_density",
    "road_density",
]

FEATURE_LABELS = {
    "ndvi_mean": "Vegetation (NDVI)",
    "ndbi_mean": "Built-up index (NDBI)",
    "ndwi_mean": "Water index (NDWI)",
    "albedo_mean": "Surface albedo",
    "built_fraction": "Built-up fraction",
    "vegetation_fraction": "Green cover fraction",
    "water_fraction": "Water fraction",
    "open_land_fraction": "Open/barren land fraction",
    "air_temp_max": "Max air temperature (°C)",
    "relative_humidity": "Relative humidity (%)",
    "wind_speed": "Wind speed (m/s)",
    "population_density": "Population density (/km²)",
    "road_density": "Road density (km/km²)",
}

# (phrase when value is low, phrase when value is high) used by the SHAP narrative generator
FEATURE_PHRASES = {
    "ndvi_mean": ("low vegetation cover", "dense vegetation cover"),
    "ndbi_mean": ("low built-up intensity", "high built-up density"),
    "ndwi_mean": ("a weak open-water signal (low NDWI)", "a strong open-water / moisture signal (high NDWI)"),
    "albedo_mean": ("dark, heat-absorbing surfaces (low albedo)", "reflective surfaces (high albedo)"),
    "built_fraction": ("a small share of built-up land", "a large share of impervious built-up land"),
    "vegetation_fraction": ("scarce green cover", "abundant green cover"),
    "water_fraction": ("absence of water bodies", "presence of water bodies"),
    "open_land_fraction": ("little exposed open land", "extensive exposed barren/fallow land"),
    "air_temp_max": ("lower ambient air temperature", "elevated ambient air temperature"),
    "relative_humidity": ("dry air (low humidity)", "humid air"),
    "wind_speed": ("weak winds limiting ventilation", "strong winds aiding ventilation"),
    "population_density": ("low population density", "high population density (anthropogenic heat)"),
    "road_density": ("sparse road network", "dense road network (paved surfaces)"),
}

SEVERITY_CLASSES = ["Low", "Moderate", "High", "Very High"]
SEVERITY_RULE = "Low: LST < μ−0.5σ · Moderate: μ−0.5σ ≤ LST < μ+0.5σ · High: μ+0.5σ ≤ LST < μ+1.5σ · Very High: LST ≥ μ+1.5σ"


def select_features(df: pd.DataFrame) -> list[str]:
    """Use candidate features that are present and at least 50 % populated."""
    feats = []
    for f in CANDIDATE_FEATURES:
        if f in df.columns and df[f].notna().mean() >= 0.5 and df[f].nunique(dropna=True) > 1:
            feats.append(f)
    return feats


def severity_thresholds(lst: np.ndarray) -> dict:
    v = np.asarray(lst, dtype=float)
    v = v[np.isfinite(v)]
    mu, sd = float(v.mean()), float(v.std())
    return {"mean": mu, "std": sd, "low_moderate": mu - 0.5 * sd, "moderate_high": mu + 0.5 * sd, "high_very_high": mu + 1.5 * sd, "rule": SEVERITY_RULE}


def classify_severity(lst, thr: dict) -> np.ndarray:
    v = np.asarray(lst, dtype=float)
    out = np.full(v.shape, -1, dtype=int)
    ok = np.isfinite(v)
    out[ok] = np.digitize(v[ok], [thr["low_moderate"], thr["moderate_high"], thr["high_very_high"]])
    return out
