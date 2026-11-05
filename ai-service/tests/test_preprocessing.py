import numpy as np
import pandas as pd

from app.geospatial.hotspots import getis_ord_gi_star
from app.models.features import classify_severity, severity_thresholds
from app.preprocessing import cleaning


def test_clean_meteorological_handles_duplicates_outliers_and_gaps():
    df = pd.DataFrame({
        "station_id": ["A"] * 6 + ["B"] * 3,
        "latitude": [21.1] * 9,
        "longitude": [79.0] * 9,
        "date": ["2026-04-01", "2026-04-02", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-01", "2026-04-02", "2026-04-03"],
        "air_temp_max_c": [40.0, 41.0, 41.0, None, 99.9, 42.0, 39.0, 39.5, 40.0],
        "relative_humidity_pct": [20, 21, 21, 22, -5, 23, 30, 31, 32],
    })
    out, rep = cleaning.clean_meteorological(df)
    assert rep["duplicates_removed"] == 1
    assert rep["range_violations_removed"] == 2  # 99.9 degC and -5 % RH
    assert rep["missing_after_imputation"] == 0
    assert out["air_temp_max_c"].between(-10, 55).all()


def test_fill_small_gaps_and_outlier_clipping():
    a = np.arange(100, dtype=float).reshape(10, 10)
    a[5, 5] = np.nan
    filled, n = cleaning.fill_small_gaps(a, 1.5)
    assert n == 1 and np.isfinite(filled[5, 5])
    b = np.r_[np.ones(999), 1000.0]
    clipped, n_out = cleaning.clip_outliers(b, 0.5, 99.5)
    assert n_out >= 1 and clipped.max() < 1000


def test_idw_exact_at_station_and_bounded():
    gx, gy = np.meshgrid(np.linspace(0, 1000, 11), np.linspace(0, 1000, 11))
    out = cleaning.idw_interpolate([0, 1000], [0, 1000], [30.0, 40.0], gx, gy)
    assert out[0, 0] == np.float64(out[0, 0]) and abs(out[0, 0] - 30) < 0.01
    assert 30 <= out.min() and out.max() <= 40


def test_severity_thresholds_documented_rule():
    lst = np.array([30, 38, 39, 40, 41, 42, 55, np.nan])
    thr = severity_thresholds(lst)
    assert thr["high_very_high"] == thr["mean"] + 1.5 * thr["std"]
    cls = classify_severity(lst, thr)
    assert cls[-1] == -1  # missing LST -> unlabelled
    assert cls[0] == 0 and cls[6] == 3  # 30 °C < μ-0.5σ ; 55 °C ≥ μ+1.5σ
    assert list(cls[:7]) == sorted(cls[:7])


def test_gi_star_flags_hot_cluster():
    grid = np.full((10, 10), 35.0) + np.random.default_rng(0).normal(0, 0.2, (10, 10))
    grid[2:5, 2:5] = 45.0
    z = getis_ord_gi_star(grid)
    assert z[3, 3] > 1.96
    assert abs(z[8, 8]) < 1.96
