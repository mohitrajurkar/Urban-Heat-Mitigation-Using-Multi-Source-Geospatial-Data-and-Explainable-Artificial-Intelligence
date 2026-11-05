"""Data cleaning: invalid pixels, outliers, missing values, normalisation and tabular QA."""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from scipy.ndimage import distance_transform_edt

log = logging.getLogger(__name__)

# Physically plausible ranges used for meteorological QA
MET_RANGES = {
    "air_temp_max_c": (-10.0, 55.0),
    "air_temp_min_c": (-15.0, 45.0),
    "relative_humidity_pct": (0.0, 100.0),
    "wind_speed_ms": (0.0, 40.0),
    "solar_radiation_wm2": (0.0, 1400.0),
}
MET_REQUIRED = ["station_id", "latitude", "longitude", "date", "air_temp_max_c"]


def mask_range(arr: np.ndarray, lo: float, hi: float) -> tuple[np.ndarray, int]:
    out = np.array(arr, dtype=np.float64, copy=True)
    bad = np.isfinite(out) & ((out < lo) | (out > hi))
    out[bad] = np.nan
    return out, int(bad.sum())


def clip_outliers(arr: np.ndarray, low_pct: float = 0.5, high_pct: float = 99.5) -> tuple[np.ndarray, int]:
    """Winsorise values outside the given percentiles (computed on valid pixels)."""
    out = np.array(arr, dtype=np.float64, copy=True)
    valid = np.isfinite(out)
    if valid.sum() < 10:
        return out, 0
    lo, hi = np.percentile(out[valid], [low_pct, high_pct])
    n = int(((out < lo) | (out > hi)).sum())
    out[valid] = np.clip(out[valid], lo, hi)
    return out, n


def fill_small_gaps(arr: np.ndarray, max_distance_px: float = 2.0) -> tuple[np.ndarray, int]:
    """Nearest-neighbour fill of NaN pixels within max_distance of a valid pixel.

    Larger gaps (e.g. cloud patches) stay NaN and are excluded from labels; the ML
    models still predict those areas from the remaining features.
    """
    out = np.array(arr, dtype=np.float64, copy=True)
    invalid = ~np.isfinite(out)
    if not invalid.any() or invalid.all():
        return out, 0
    dist, (ri, ci) = distance_transform_edt(invalid, return_indices=True)
    fill = invalid & (dist <= max_distance_px)
    out[fill] = out[ri[fill], ci[fill]]
    return out, int(fill.sum())


def minmax_normalize(values, invert: bool = False) -> np.ndarray:
    v = np.asarray(values, dtype=np.float64)
    finite = np.isfinite(v)
    out = np.full(v.shape, np.nan)
    if finite.sum() == 0:
        return out
    lo, hi = np.nanmin(v), np.nanmax(v)
    out[finite] = 0.5 if hi - lo < 1e-12 else (v[finite] - lo) / (hi - lo)
    return 1.0 - out if invert else out


def percentile_rank(values) -> np.ndarray:
    s = pd.Series(np.asarray(values, dtype=np.float64))
    return s.rank(pct=True).to_numpy()


def clean_meteorological(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Clean station observations: types, duplicates, physical-range QA, IQR outliers, interpolation."""
    report: dict = {"rows_in": int(len(df))}
    df = df.copy()
    df.columns = [c.strip().lower() for c in df.columns]
    missing = [c for c in MET_REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"Meteorological CSV missing required columns: {missing}")
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date", "latitude", "longitude"])
    before = len(df)
    df = df.drop_duplicates(subset=["station_id", "date"])
    report["duplicates_removed"] = int(before - len(df))

    numeric_cols = [c for c in MET_RANGES if c in df.columns]
    range_violations, iqr_outliers = 0, 0
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        lo, hi = MET_RANGES[col]
        bad = (df[col] < lo) | (df[col] > hi)
        range_violations += int(bad.sum())
        df.loc[bad, col] = np.nan
        # per-station IQR outlier screening (3 x IQR is conservative)
        q1 = df.groupby("station_id")[col].transform(lambda s: s.quantile(0.25))
        q3 = df.groupby("station_id")[col].transform(lambda s: s.quantile(0.75))
        iqr = q3 - q1
        out = (df[col] < q1 - 3 * iqr) | (df[col] > q3 + 3 * iqr)
        iqr_outliers += int(out.sum())
        df.loc[out, col] = np.nan
    report["range_violations_removed"] = range_violations
    report["iqr_outliers_removed"] = iqr_outliers
    report["missing_before_imputation"] = int(df[numeric_cols].isna().sum().sum())

    df = df.sort_values(["station_id", "date"])
    for col in numeric_cols:
        df[col] = df.groupby("station_id")[col].transform(lambda s: s.interpolate(limit_direction="both"))
        df[col] = df[col].fillna(df[col].median())
    report["missing_after_imputation"] = int(df[numeric_cols].isna().sum().sum())
    report["rows_out"] = int(len(df))
    report["stations"] = int(df["station_id"].nunique())
    report["period"] = [str(df["date"].min().date()), str(df["date"].max().date())] if len(df) else None
    return df, report


def aggregate_stations(df: pd.DataFrame) -> pd.DataFrame:
    cols = [c for c in MET_RANGES if c in df.columns]
    agg = df.groupby("station_id").agg({"latitude": "first", "longitude": "first", **{c: "mean" for c in cols}})
    if "station_name" in df.columns:
        agg["station_name"] = df.groupby("station_id")["station_name"].first()
    return agg.reset_index()


def idw_interpolate(xs, ys, values, grid_x, grid_y, power: float = 2.0) -> np.ndarray:
    """Inverse-distance-weighted interpolation of station values onto grid coordinates."""
    xs, ys, values = map(lambda a: np.asarray(a, dtype=np.float64), (xs, ys, values))
    ok = np.isfinite(values)
    xs, ys, values = xs[ok], ys[ok], values[ok]
    if len(values) == 0:
        return np.full(np.shape(grid_x), np.nan)
    if len(values) == 1:
        return np.full(np.shape(grid_x), values[0])
    gx, gy = np.asarray(grid_x, dtype=np.float64), np.asarray(grid_y, dtype=np.float64)
    num = np.zeros(gx.shape)
    den = np.zeros(gx.shape)
    for x, y, v in zip(xs, ys, values):
        d = np.hypot(gx - x, gy - y)
        w = 1.0 / np.maximum(d, 1.0) ** power
        num += w * v
        den += w
    return num / den
