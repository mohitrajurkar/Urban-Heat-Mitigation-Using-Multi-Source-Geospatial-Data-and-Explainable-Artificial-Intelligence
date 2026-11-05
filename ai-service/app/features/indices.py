"""Environmental indicator formulas (NDVI, NDBI, NDWI, LST, surface albedo, LULC fallback).

All functions are vectorised over NumPy arrays, propagate NaN for invalid pixels and
guard against division by zero. See docs/METHODOLOGY.md for references.
"""
from __future__ import annotations

import numpy as np

# Planck-derived constant rho = h*c/sigma (micrometre Kelvin)
RHO_UM_K = 14388.0
LANDSAT_B10_WAVELENGTH_UM = 10.895

# Default Landsat 8/9 Collection 2 Level-1 rescaling constants (overridden by scene metadata / MTL)
LANDSAT_L1_DEFAULTS = {
    "REFLECTANCE_MULT": 2.0e-5,
    "REFLECTANCE_ADD": -0.1,
    "RADIANCE_MULT_B10": 3.342e-4,
    "RADIANCE_ADD_B10": 0.1,
    "K1_CONSTANT_BAND_10": 774.8853,
    "K2_CONSTANT_BAND_10": 1321.0789,
    "SUN_ELEVATION": 60.0,
}
# Landsat Collection 2 Level-2 scale factors (surface reflectance / surface temperature)
LANDSAT_L2_SR_MULT, LANDSAT_L2_SR_ADD = 2.75e-5, -0.2
LANDSAT_L2_ST_MULT, LANDSAT_L2_ST_ADD = 0.00341802, 149.0

# Unified LULC scheme used across the system
LULC_CLASSES = {
    1: "Water",
    2: "Dense Vegetation / Forest",
    3: "Urban Green / Sparse Vegetation",
    4: "Agriculture / Cropland",
    5: "Barren / Open Land",
    6: "Residential Built-up",
    7: "Commercial / Dense Built-up",
    8: "Industrial",
}
BUILT_CLASSES = (6, 7, 8)
VEGETATION_CLASSES = (2, 3)
OPEN_CLASSES = (4, 5)
# ESA WorldCover 2021 (10 m) codes -> unified scheme, so real WorldCover tiles can be uploaded
ESA_WORLDCOVER_MAP = {10: 2, 20: 3, 30: 3, 40: 4, 50: 6, 60: 5, 70: 5, 80: 1, 90: 1, 95: 2, 100: 3}


def _as_float(a) -> np.ndarray:
    return np.asarray(a, dtype=np.float64)


def safe_normalized_difference(a, b, eps: float = 1e-6) -> np.ndarray:
    """(a - b) / (a + b) with NaN where inputs are invalid or the denominator is ~0."""
    a, b = _as_float(a), _as_float(b)
    out = np.full(np.broadcast(a, b).shape, np.nan)
    denom = a + b
    valid = np.isfinite(a) & np.isfinite(b) & (np.abs(denom) > eps)
    out[valid] = (a[valid] - b[valid]) / denom[valid]
    return np.clip(out, -1.0, 1.0)


def ndvi(nir, red) -> np.ndarray:
    """NDVI = (NIR - Red) / (NIR + Red)."""
    return safe_normalized_difference(nir, red)


def ndbi(swir, nir) -> np.ndarray:
    """NDBI = (SWIR - NIR) / (SWIR + NIR)."""
    return safe_normalized_difference(swir, nir)


def ndwi(green, nir) -> np.ndarray:
    """McFeeters NDWI = (Green - NIR) / (Green + NIR)."""
    return safe_normalized_difference(green, nir)


def dn_to_toa_reflectance(dn, mult: float, add: float, sun_elevation_deg: float) -> np.ndarray:
    """Landsat L1 DN -> sun-angle corrected TOA reflectance (USGS Landsat 8/9 Data Users Handbook)."""
    dn = _as_float(dn)
    sin_e = np.sin(np.radians(sun_elevation_deg))
    if sin_e <= 0:
        raise ValueError("Sun elevation must be > 0 degrees")
    rho = (mult * dn + add) / sin_e
    rho[~np.isfinite(dn) | (dn <= 0)] = np.nan
    rho[(rho < -0.05) | (rho > 1.5)] = np.nan
    return np.clip(rho, 0.0, 1.0)


def l2_surface_reflectance(dn) -> np.ndarray:
    dn = _as_float(dn)
    sr = dn * LANDSAT_L2_SR_MULT + LANDSAT_L2_SR_ADD
    sr[~np.isfinite(dn) | (dn <= 0)] = np.nan
    sr[(sr < -0.05) | (sr > 1.5)] = np.nan
    return np.clip(sr, 0.0, 1.0)


def dn_to_radiance(dn, mult: float, add: float) -> np.ndarray:
    """L_lambda = M_L * Q_cal + A_L (W m-2 sr-1 um-1)."""
    dn = _as_float(dn)
    rad = mult * dn + add
    rad[~np.isfinite(dn) | (dn <= 0)] = np.nan
    rad[rad <= 0] = np.nan
    return rad


def radiance_to_brightness_temperature(radiance, k1: float, k2: float) -> np.ndarray:
    """BT = K2 / ln(K1 / L + 1)  (Kelvin)."""
    rad = _as_float(radiance)
    out = np.full(rad.shape, np.nan)
    valid = np.isfinite(rad) & (rad > 0)
    out[valid] = k2 / np.log(k1 / rad[valid] + 1.0)
    return out


def proportion_of_vegetation(ndvi_arr, ndvi_soil: float = 0.2, ndvi_veg: float = 0.5) -> np.ndarray:
    """Pv = ((NDVI - NDVIs) / (NDVIv - NDVIs))^2, clipped to [0, 1]."""
    v = _as_float(ndvi_arr)
    pv = ((v - ndvi_soil) / (ndvi_veg - ndvi_soil)) ** 2
    pv = np.where(v < ndvi_soil, 0.0, pv)
    pv = np.where(v > ndvi_veg, 1.0, pv)
    pv[~np.isfinite(v)] = np.nan
    return np.clip(pv, 0.0, 1.0)


def emissivity_from_ndvi(ndvi_arr, ndwi_arr=None) -> np.ndarray:
    """NDVI-threshold emissivity (Sobrino et al., 2004).

    water (NDVI < 0 or NDWI > 0.1): 0.991; bare soil (NDVI < 0.2): 0.973;
    full vegetation (NDVI > 0.5): 0.990; mixed: 0.004 * Pv + 0.986.
    """
    v = _as_float(ndvi_arr)
    pv = proportion_of_vegetation(v)
    eps = 0.004 * pv + 0.986
    eps = np.where(v < 0.2, 0.973, eps)
    eps = np.where(v > 0.5, 0.990, eps)
    water = v < 0.0
    if ndwi_arr is not None:
        water = water | (_as_float(ndwi_arr) > 0.1)
    eps = np.where(water, 0.991, eps)
    eps = eps.astype(np.float64)
    eps[~np.isfinite(v)] = np.nan
    return eps


def land_surface_temperature(bt_kelvin, emissivity, wavelength_um: float = LANDSAT_B10_WAVELENGTH_UM) -> np.ndarray:
    """Single-channel emissivity correction: LST = BT / (1 + (lambda * BT / rho) * ln(eps)) -> degC."""
    bt, eps = _as_float(bt_kelvin), _as_float(emissivity)
    out = np.full(np.broadcast(bt, eps).shape, np.nan)
    valid = np.isfinite(bt) & np.isfinite(eps) & (eps > 0)
    out[valid] = bt[valid] / (1.0 + (wavelength_um * bt[valid] / RHO_UM_K) * np.log(eps[valid]))
    out = out - 273.15
    out[(out < -30) | (out > 80)] = np.nan  # physically implausible for this context
    return out


def brightness_temperature_from_lst(lst_celsius, emissivity, wavelength_um: float = LANDSAT_B10_WAVELENGTH_UM) -> np.ndarray:
    """Exact inverse of land_surface_temperature (used by the synthetic data generator and tests)."""
    t = _as_float(lst_celsius) + 273.15
    eps = _as_float(emissivity)
    return t / (1.0 - (wavelength_um * t / RHO_UM_K) * np.log(eps))


def surface_albedo_landsat(blue, red, nir, swir1, swir2) -> np.ndarray:
    """Liang (2001) shortwave broadband albedo, OLI coefficients (Smith 2010 normalisation)."""
    b2, b4, b5, b6, b7 = map(_as_float, (blue, red, nir, swir1, swir2))
    alb = 0.356 * b2 + 0.130 * b4 + 0.373 * b5 + 0.085 * b6 + 0.072 * b7 - 0.0018
    alb = alb / 1.016
    return np.clip(alb, 0.0, 1.0)


def surface_albedo_sentinel2(b2, b3, b4, b8, b11, b12) -> np.ndarray:
    """Bonafoni & Sekertekin (2020) Sentinel-2 MSI broadband albedo."""
    b2, b3, b4, b8, b11, b12 = map(_as_float, (b2, b3, b4, b8, b11, b12))
    alb = 0.2266 * b2 + 0.1236 * b3 + 0.1573 * b4 + 0.3417 * b8 + 0.1170 * b11 + 0.0338 * b12
    return np.clip(alb, 0.0, 1.0)


def classify_lulc_from_indices(ndvi_arr, ndbi_arr, ndwi_arr) -> np.ndarray:
    """Rule-based LULC fallback used only when no classified LULC dataset is supplied."""
    v, b, w = map(_as_float, (ndvi_arr, ndbi_arr, ndwi_arr))
    out = np.zeros(v.shape, dtype=np.uint8)
    out[(v >= 0.15) & (v < 0.25)] = 4
    out[(v < 0.15) & (b < 0.05)] = 5
    out[(v < 0.2) & (b >= 0.05)] = 6
    out[(v < 0.12) & (b >= 0.12)] = 7
    out[(v >= 0.25) & (v < 0.45)] = 3
    out[v >= 0.45] = 2
    out[(w > 0.05) | (v < 0.0)] = 1
    out[~(np.isfinite(v) & np.isfinite(b) & np.isfinite(w))] = 0
    return out


def remap_lulc(arr, mapping: dict[int, int] | None) -> np.ndarray:
    a = np.asarray(arr)
    if not mapping:
        return a.astype(np.uint8)
    out = np.zeros(a.shape, dtype=np.uint8)
    for src, dst in mapping.items():
        out[a == src] = dst
    return out
