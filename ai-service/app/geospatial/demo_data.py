"""Deterministic generator of SYNTHETIC demonstration datasets for Nagpur.

IMPORTANT - NOT REAL OBSERVATIONS
---------------------------------
Every file written by this module is synthetic. The generator builds latent land
cover / vegetation / imperviousness fields shaped around approximate Nagpur
localities, lakes and forests, derives surface reflectance from typical spectral
signatures, models land surface temperature from physically reasonable
relationships, and then *inverts* the Landsat calibration chain (reflectance ->
DN, LST -> brightness temperature -> radiance -> DN). The analysis pipeline then
performs the real forward retrieval on these files exactly as it would on a real
Landsat 8/9 Collection 2 Level-1 scene. Metadata of every file says
`is_demo: true, is_real: false`.

Run directly to regenerate:  python -m app.geospatial.demo_data
"""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
from pyproj import Transformer
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject
from scipy.ndimage import gaussian_filter

from app.config import SAMPLE_DIR
from app.features import indices
from app.geospatial.study_area import NAGPUR, NAGPUR_FORESTS, NAGPUR_INDUSTRIAL, NAGPUR_WATER_BODIES

log = logging.getLogger(__name__)
SEED = 20260418
DEMO_NOTE = "SYNTHETIC DEMONSTRATION DATA - not a real satellite/ground observation"

LANDSAT_META = {
    "SPACECRAFT_ID": "LANDSAT_9 (synthetic replica)",
    "SENSOR_ID": "OLI_TIRS",
    "PROCESSING_LEVEL": "L1TP",
    "PRODUCT_LEVEL": "L1",
    "DATE_ACQUIRED": "2026-04-18",
    "SCENE_CENTER_TIME": "05:11:42Z",
    "WRS_PATH": 144,
    "WRS_ROW": 45,
    "SUN_ELEVATION": 66.2,
    "SUN_AZIMUTH": 108.7,
    "REFLECTANCE_MULT": 2.0e-5,
    "REFLECTANCE_ADD": -0.1,
    "RADIANCE_MULT_B10": 3.342e-4,
    "RADIANCE_ADD_B10": 0.1,
    "K1_CONSTANT_BAND_10": 774.8853,
    "K2_CONSTANT_BAND_10": 1321.0789,
    "BAND_ORDER": ["B2", "B3", "B4", "B5", "B6", "B7", "B10"],
}

# Surface-reflectance signatures [B2 blue, B3 green, B4 red, B5 NIR, B6 SWIR1, B7 SWIR2]
VEG = np.array([0.025, 0.06, 0.035, 0.42, 0.18, 0.08])
BASE_SIG = {
    1: np.array([0.07, 0.08, 0.05, 0.025, 0.012, 0.008]),  # water
    2: np.array([0.06, 0.09, 0.12, 0.20, 0.28, 0.22]),  # forest understory soil
    3: np.array([0.07, 0.10, 0.13, 0.21, 0.29, 0.23]),  # urban green soil
    4: np.array([0.08, 0.11, 0.15, 0.22, 0.32, 0.26]),  # fallow cropland
    5: np.array([0.11, 0.15, 0.21, 0.27, 0.36, 0.30]),  # barren
    6: np.array([0.10, 0.12, 0.14, 0.18, 0.24, 0.20]),  # residential roofs/roads
    7: np.array([0.12, 0.14, 0.16, 0.19, 0.27, 0.24]),  # commercial
    8: np.array([0.13, 0.15, 0.17, 0.20, 0.29, 0.27]),  # industrial
}
HEAT_CAPACITY_FACTOR = {1: 0.0, 2: 0.75, 3: 0.78, 4: 0.95, 5: 1.05, 6: 0.92, 7: 0.98, 8: 1.02}

STATIONS = [
    ("DEMO-NGP-01", "Sonegaon (demo station)", 21.0920, 79.0470, 0.4),
    ("DEMO-NGP-02", "Civil Lines (demo station)", 21.1560, 79.0750, -0.3),
    ("DEMO-NGP-03", "Itwari (demo station)", 21.1550, 79.1100, 1.1),
    ("DEMO-NGP-04", "Hingna (demo station)", 21.1080, 78.9900, 0.6),
    ("DEMO-NGP-05", "Kalamna (demo station)", 21.1750, 79.1400, 0.8),
    ("DEMO-NGP-06", "Gorewada (demo station)", 21.2000, 79.0380, -0.9),
    ("DEMO-NGP-07", "Besa (demo station)", 21.0800, 79.1000, 0.2),
]


def _smooth_noise(rng, shape, sigma):
    f = gaussian_filter(rng.normal(size=shape), sigma)
    return (f - f.mean()) / (f.std() + 1e-12)


def _utm_grid(bbox, epsg, res, margin=1500):
    tr = Transformer.from_crs(4326, epsg, always_xy=True)
    xs, ys = tr.transform([bbox[0], bbox[2], bbox[0], bbox[2]], [bbox[1], bbox[1], bbox[3], bbox[3]])
    xmin = math.floor((min(xs) - margin) / res) * res
    xmax = math.ceil((max(xs) + margin) / res) * res
    ymin = math.floor((min(ys) - margin) / res) * res
    ymax = math.ceil((max(ys) + margin) / res) * res
    w, h = int((xmax - xmin) / res), int((ymax - ymin) / res)
    return from_origin(xmin, ymax, res, res), w, h


def _lonlat(transform, w, h, epsg):
    cols = transform.c + (np.arange(w) + 0.5) * transform.a
    rows = transform.f + (np.arange(h) + 0.5) * transform.e
    x, y = np.meshgrid(cols, rows)
    lon, lat = Transformer.from_crs(epsg, 4326, always_xy=True).transform(x, y)
    return np.asarray(lon), np.asarray(lat), x, y


def _write_tif(path: Path, arr: np.ndarray, transform, epsg, dtype, nodata, descriptions, tags):
    arr = arr if arr.ndim == 3 else arr[None]
    with rasterio.open(
        path, "w", driver="GTiff", width=arr.shape[2], height=arr.shape[1], count=arr.shape[0], dtype=dtype,
        crs=CRS.from_epsg(epsg), transform=transform, nodata=nodata, compress="deflate", predictor=2, tiled=True,
    ) as ds:
        ds.write(arr.astype(dtype))
        for i, d in enumerate(descriptions, start=1):
            ds.set_band_description(i, d)
        ds.update_tags(**{k: str(v) for k, v in tags.items()})


def _meta(path: Path, **kw):
    base = {"is_demo": True, "is_real": False, "note": DEMO_NOTE, "generator": "app.geospatial.demo_data", "seed": SEED}
    base.update(kw)
    base["file_name"] = path.name
    base["file_size"] = path.stat().st_size
    path.with_suffix(path.suffix + ".meta.json").write_text(json.dumps(base, indent=2), encoding="utf-8")
    return base


def generate_demo_datasets(out_dir: Path = SAMPLE_DIR, force: bool = False) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    catalog_path = out_dir / "catalog.json"
    if catalog_path.exists() and not force:
        return json.loads(catalog_path.read_text(encoding="utf-8"))
    log.info("Generating synthetic Nagpur demonstration datasets in %s", out_dir)
    rng = np.random.default_rng(SEED)
    sa = NAGPUR
    epsg, res = sa.epsg, 30
    transform, w, h = _utm_grid(sa.bbox, epsg, res)
    lon, lat, gx, gy = _lonlat(transform, w, h, epsg)
    kx, ky = 111.32 * math.cos(math.radians(21.14)), 110.57

    def d2(lo, la):
        return ((lon - lo) * kx) ** 2 + ((lat - la) * ky) ** 2

    # ---- latent urban intensity --------------------------------------------------
    urban = 0.95 * np.exp(-d2(79.092, 21.146) / (2 * 3.7**2))
    for loc in sa.localities:
        urban += loc.intensity * 0.55 * np.exp(-d2(loc.lon, loc.lat) / (2 * loc.spread_km**2))
    urban = np.clip(urban + 0.10 * _smooth_noise(rng, (h, w), 6), 0, 1.4)

    water = np.zeros((h, w), bool)
    dist_water = np.full((h, w), 99.0)
    edge = _smooth_noise(rng, (h, w), 3)
    for wb in NAGPUR_WATER_BODIES:
        dx, dy = (lon - wb.lon) * kx, (lat - wb.lat) * ky
        r = np.sqrt((dx / wb.semi_x_km) ** 2 + (dy / wb.semi_y_km) ** 2)
        water |= r + 0.08 * edge <= 1.0
        dist_water = np.minimum(dist_water, np.maximum(r - 1.0, 0) * min(wb.semi_x_km, wb.semi_y_km))
    forest_f = sum(np.exp(-d2(z.lon, z.lat) / (2 * z.radius_km**2)) for z in NAGPUR_FORESTS)
    forest = (forest_f + 0.25 * _smooth_noise(rng, (h, w), 4)) > 0.55
    ind_f = sum(np.exp(-d2(z.lon, z.lat) / (2 * (z.radius_km * 0.7) ** 2)) for z in NAGPUR_INDUSTRIAL)
    industrial = (ind_f + 0.2 * _smooth_noise(rng, (h, w), 3)) > 0.55

    built = urban + 0.12 * _smooth_noise(rng, (h, w), 2)
    green_pockets = _smooth_noise(rng, (h, w), 3)
    rural = _smooth_noise(rng, (h, w), 10)
    rural_veg = _smooth_noise(rng, (h, w), 4)

    lulc = np.where(rural > -0.55, 4, 5).astype(np.uint8)
    lulc[rural_veg > 1.1] = 3
    lulc[built > 0.36] = 6
    lulc[(built > 0.36) & (green_pockets > 1.45)] = 3
    lulc[built > 0.82] = 7
    lulc[industrial] = 8
    lulc[forest] = 2
    lulc[water] = 1

    # ---- sub-pixel vegetation fraction ---------------------------------------------
    n_fv = _smooth_noise(rng, (h, w), 1.5)
    fv_mean = {1: 0.0, 2: 0.88, 3: 0.60, 4: 0.22, 5: 0.06, 6: 0.15, 7: 0.08, 8: 0.05}
    fv_sd = {1: 0.0, 2: 0.06, 3: 0.12, 4: 0.10, 5: 0.04, 6: 0.07, 7: 0.04, 8: 0.03}
    fv = np.zeros((h, w))
    for c in range(1, 9):
        m = lulc == c
        fv[m] = fv_mean[c] + fv_sd[c] * n_fv[m]
    fv[(lulc == 6)] -= 0.06 * (urban[lulc == 6] - 0.6)
    fv = np.clip(fv, 0, 1)

    brightness = 1.0 + 0.12 * _smooth_noise(rng, (h, w), 1.0)  # roof material variability
    refl = np.zeros((6, h, w))
    for c in range(1, 9):
        m = lulc == c
        sig = BASE_SIG[c][:, None]
        b = brightness[m] if c in (6, 7, 8) else 1.0
        refl[:, m] = (1 - fv[m]) * sig * b + fv[m] * VEG[:, None]
    refl *= 1.0 + 0.025 * rng.normal(size=refl.shape)
    refl = np.clip(refl, 0.002, 0.9)

    # ---- meteorology (station means -> IDW field) ---------------------------------
    met_df = _meteorological_csv(rng)
    from app.preprocessing.cleaning import aggregate_stations, clean_meteorological, idw_interpolate

    clean, _ = clean_meteorological(met_df)
    st = aggregate_stations(clean)
    sx, sy = Transformer.from_crs(4326, epsg, always_xy=True).transform(st["longitude"].values, st["latitude"].values)
    air_t = idw_interpolate(sx, sy, st["air_temp_max_c"].values, gx, gy)
    wind = idw_interpolate(sx, sy, st["wind_speed_ms"].values, gx, gy)

    # ---- land surface temperature model (degC) -------------------------------------
    hc = np.vectorize(HEAT_CAPACITY_FACTOR.get)(lulc).astype(float)
    alb = indices.surface_albedo_landsat(refl[0], refl[2], refl[3], refl[4], refl[5])
    lst = (
        30.5
        + 14.0 * (1 - fv) * hc
        + 2.6 * np.clip(urban, 0, 1.2) * (lulc >= 6)
        - 12.0 * (alb - 0.16) * (1 - fv) * (lulc != 1)
        + 0.9 * (air_t - 41.0)
        - 0.7 * (wind - 3.0)
        - 2.2 * np.exp(-dist_water / 0.45) * (lulc != 1)
        + 1.1 * _smooth_noise(rng, (h, w), 5)
        + 0.45 * rng.normal(size=(h, w))
    )
    lst[lulc == 1] = 28.8 + 0.5 * rng.normal(size=int((lulc == 1).sum())) + 0.4 * (air_t[lulc == 1] - 41)

    # ---- invert the Landsat calibration chain -> DNs --------------------------------
    m = LANDSAT_META
    sin_e = math.sin(math.radians(m["SUN_ELEVATION"]))
    dn_refl = np.round((refl * sin_e - m["REFLECTANCE_ADD"]) / m["REFLECTANCE_MULT"])
    toa = (dn_refl * m["REFLECTANCE_MULT"] + m["REFLECTANCE_ADD"]) / sin_e
    nd_v = indices.ndvi(toa[3], toa[2])
    nd_w = indices.ndwi(toa[1], toa[3])
    eps = indices.emissivity_from_ndvi(nd_v, nd_w)
    bt = indices.brightness_temperature_from_lst(lst, eps)
    rad = m["K1_CONSTANT_BAND_10"] / (np.exp(m["K2_CONSTANT_BAND_10"] / bt) - 1.0)
    dn_t = np.round((rad - m["RADIANCE_ADD_B10"]) / m["RADIANCE_MULT_B10"])
    stack = np.concatenate([dn_refl, dn_t[None]], axis=0)
    stack = np.clip(stack, 1, 65534)

    # simulated data gaps (fill value 0) and saturated pixels -> exercised by invalid-pixel handling
    gap = np.zeros((h, w), bool)
    for clon, clat, rkm in [(79.165, 21.215, 0.9), (78.985, 21.065, 0.7), (79.13, 21.075, 0.5)]:
        gap |= d2(clon, clat) < rkm**2
    gap |= rng.random((h, w)) < 0.002
    stack[:, gap] = 0
    sat = rng.random((h, w)) < 0.0005
    stack[2, sat] = 65535

    catalog = []
    p = out_dir / "landsat9_nagpur_2026-04-18_L1_DEMO.tif"
    _write_tif(p, stack, transform, epsg, "uint16", 0, m["BAND_ORDER"], {"NOTE": DEMO_NOTE, **{k: v for k, v in m.items() if k != "BAND_ORDER"}})
    catalog.append(_meta(
        p, dataset_id="demo-landsat9", name="Landsat 9 OLI/TIRS L1 scene - Nagpur (synthetic demo)", data_type="landsat",
        source="Synthetic replica of a Landsat 9 Collection 2 Level-1 scene (USGS EarthExplorer format)",
        collection_date=m["DATE_ACQUIRED"], coverage="Nagpur Municipal Corporation area and periphery, 30 m, UTM 44N",
        file_format="GeoTIFF", landsat_params={k: v for k, v in m.items()},
    ))

    # ---- classified LULC (30 m) with 4% simulated misclassification ----------------
    lulc_obs = lulc.copy()
    flip = rng.random((h, w)) < 0.04
    lulc_obs[flip] = np.roll(lulc, 3, axis=1)[flip]
    p = out_dir / "lulc_nagpur_2026_DEMO.tif"
    _write_tif(p, lulc_obs, transform, epsg, "uint8", 0, ["LULC"], {"NOTE": DEMO_NOTE, "CLASSES": json.dumps(indices.LULC_CLASSES)})
    catalog.append(_meta(
        p, dataset_id="demo-lulc", name="Land Use / Land Cover 2026 - Nagpur (synthetic demo)", data_type="lulc",
        source="Synthetic 8-class LULC map (scheme compatible with ESA WorldCover remapping)", collection_date="2026-04-01",
        coverage="Nagpur study area, 30 m, UTM 44N", file_format="GeoTIFF", class_scheme=indices.LULC_CLASSES, lulc_mapping=None,
    ))

    # ---- Sentinel-2 L2A subset (20 m, city core) -----------------------------------
    catalog.append(_sentinel2(out_dir, refl, transform, epsg, rng))

    # ---- population (100 m, persons per pixel, WorldPop-like) -----------------------
    catalog.append(_population(out_dir, rng, sa))

    # ---- meteorology CSV ----------------------------------------------------------
    p = out_dir / "meteorology_nagpur_apr-may_2026_DEMO.csv"
    met_df.to_csv(p, index=False)
    catalog.append(_meta(
        p, dataset_id="demo-meteo", name="Daily station meteorology Apr-May 2026 - Nagpur (synthetic demo)", data_type="meteorological",
        source="Synthetic station series modelled on IMD/ERA5 pre-monsoon climatology", collection_date="2026-04-01/2026-05-31",
        coverage="7 demo stations across Nagpur", file_format="CSV",
        notes="Contains deliberate missing values, duplicates and sensor-error outliers to demonstrate cleaning.",
    ))

    # ---- roads GeoJSON + boundary -------------------------------------------------
    catalog.append(_roads(out_dir, rng))
    catalog.append(_boundary(out_dir, sa))

    catalog_path.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    log.info("Demo datasets ready: %s", [c["dataset_id"] for c in catalog])
    return catalog


def _meteorological_csv(rng) -> pd.DataFrame:
    dates = pd.date_range("2026-04-01", "2026-05-31", freq="D")
    rows = []
    for sid, name, la, lo, off in STATIONS:
        for i, d in enumerate(dates):
            season = 39.2 + 4.0 * i / len(dates)
            rows.append({
                "station_id": sid, "station_name": name, "latitude": la, "longitude": lo, "date": d.strftime("%Y-%m-%d"),
                "air_temp_max_c": round(season + off + rng.normal(0, 1.1), 1),
                "air_temp_min_c": round(season - 14 + 0.6 * off + rng.normal(0, 1.0), 1),
                "relative_humidity_pct": round(float(np.clip(24 - 0.08 * i - 1.5 * off + rng.normal(0, 4), 8, 70)), 1),
                "wind_speed_ms": round(float(np.clip(3.1 - 0.4 * off + rng.normal(0, 0.6), 0.3, 9)), 2),
                "solar_radiation_wm2": round(float(np.clip(300 + 8 * off + rng.normal(0, 18), 150, 400)), 1),
            })
    df = pd.DataFrame(rows)
    idx = rng.choice(len(df), size=int(0.02 * len(df)), replace=False)
    df.loc[idx, "air_temp_max_c"] = np.nan
    df.loc[rng.choice(len(df), 3, replace=False), "air_temp_max_c"] = 99.9  # sensor error
    df.loc[rng.choice(len(df), 2, replace=False), "relative_humidity_pct"] = -5.0
    df.loc[rng.choice(len(df), 2, replace=False), "wind_speed_ms"] = 85.0
    df = pd.concat([df, df.iloc[[10, 200]]], ignore_index=True)  # duplicates
    return df


def _sentinel2(out_dir, refl, transform, epsg, rng):
    core = (79.02, 21.09, 79.16, 21.19)
    t2, w2, h2 = _utm_grid(core, epsg, 20, margin=0)
    bands = [1, 2, 3, 4]  # B3 green, B4 red, B8 NIR, B11 SWIR1 from the latent reflectance
    out = np.zeros((4, h2, w2), np.float32)
    for i, b in enumerate(bands):
        reproject(refl[b].astype(np.float32), out[i], src_transform=transform, src_crs=CRS.from_epsg(epsg),
                  dst_transform=t2, dst_crs=CRS.from_epsg(epsg), resampling=Resampling.bilinear)
    out *= 1.0 + 0.02 * rng.normal(size=out.shape)
    dn = np.clip(np.round(out * 10000 + 1000), 1, 65534).astype(np.uint16)  # BOA_ADD_OFFSET = -1000
    p = out_dir / "sentinel2_nagpur_core_2026-04-20_L2A_DEMO.tif"
    _write_tif(p, dn, t2, epsg, "uint16", 0, ["B03", "B04", "B08", "B11"], {"NOTE": DEMO_NOTE, "BOA_QUANTIFICATION_VALUE": 10000, "BOA_ADD_OFFSET": -1000})
    return _meta(
        p, dataset_id="demo-sentinel2", name="Sentinel-2 MSI L2A subset - Nagpur core (synthetic demo)", data_type="sentinel2",
        source="Synthetic replica of a Copernicus Sentinel-2 L2A product (B03, B04, B08, B11 at 20 m)",
        collection_date="2026-04-20", coverage="Central Nagpur (approx. 14 x 11 km), 20 m, UTM 44N", file_format="GeoTIFF",
        sentinel2_params={"BAND_ORDER": ["B03", "B04", "B08", "B11"], "BOA_QUANTIFICATION_VALUE": 10000, "BOA_ADD_OFFSET": -1000},
    )


def _population(out_dir, rng, sa):
    t, w, h = _utm_grid(sa.bbox, sa.epsg, 100)
    lon, lat, _, _ = _lonlat(t, w, h, sa.epsg)
    kx, ky = 111.32 * math.cos(math.radians(21.14)), 110.57
    dens = 9000 * np.exp(-(((lon - 79.095) * kx) ** 2 + ((lat - 21.148) * ky) ** 2) / (2 * 3.4**2))
    for loc in sa.localities:
        f = {"commercial": 9000, "residential": 12000, "periurban": 5000, "industrial": 1500, "institutional": 4000, "green": 600}[loc.kind]
        dens += f * loc.intensity * np.exp(-(((lon - loc.lon) * kx) ** 2 + ((lat - loc.lat) * ky) ** 2) / (2 * (loc.spread_km * 0.9) ** 2))
    dens *= np.exp(0.25 * _smooth_noise(rng, (h, w), 2))
    for wb in NAGPUR_WATER_BODIES:
        r = np.sqrt((((lon - wb.lon) * kx) / wb.semi_x_km) ** 2 + (((lat - wb.lat) * ky) / wb.semi_y_km) ** 2)
        dens[r <= 1] = 0
    persons = dens * 0.01  # persons per 100 m pixel
    p = out_dir / "population_nagpur_2026_100m_DEMO.tif"
    _write_tif(p, persons.astype(np.float32), t, sa.epsg, "float32", -1, ["population"], {"NOTE": DEMO_NOTE, "UNITS": "persons per pixel"})
    return _meta(
        p, dataset_id="demo-population", name="Gridded population 2026 (100 m) - Nagpur (synthetic demo)", data_type="population",
        source="Synthetic WorldPop-style constrained population grid", collection_date="2026-01-01",
        coverage="Nagpur study area, 100 m, UTM 44N", file_format="GeoTIFF", total_population=int(persons.sum()),
    )


def _roads(out_dir, rng):
    c_lon, c_lat = 79.088, 21.146
    kx, ky = 111.32 * math.cos(math.radians(c_lat)), 110.57
    feats = []

    def to_ll(xkm, ykm):
        return [round(c_lon + xkm / kx, 6), round(c_lat + ykm / ky, 6)]

    for i, ang in enumerate(range(0, 360, 30)):
        a = math.radians(ang + rng.normal(0, 4))
        pts = [to_ll(r * math.cos(a + 0.03 * math.sin(r)), r * math.sin(a + 0.03 * math.sin(r))) for r in np.linspace(0.3, 13, 40)]
        feats.append({"type": "Feature", "properties": {"name": f"Demo Radial Road {i + 1}", "highway": "primary", "is_demo": True}, "geometry": {"type": "LineString", "coordinates": pts}})
    for j, rad in enumerate([2.0, 4.5, 8.0]):
        pts = [to_ll(rad * math.cos(t), rad * 0.9 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 90)]
        feats.append({"type": "Feature", "properties": {"name": f"Demo Ring Road {j + 1}", "highway": "trunk" if j == 2 else "secondary", "is_demo": True}, "geometry": {"type": "LineString", "coordinates": pts}})
    for k in np.arange(-3.0, 3.01, 0.5):
        feats.append({"type": "Feature", "properties": {"name": "Demo street (E-W)", "highway": "residential", "is_demo": True}, "geometry": {"type": "LineString", "coordinates": [to_ll(-3.2, k), to_ll(3.2, k)]}})
        feats.append({"type": "Feature", "properties": {"name": "Demo street (N-S)", "highway": "residential", "is_demo": True}, "geometry": {"type": "LineString", "coordinates": [to_ll(k, -3.2), to_ll(k, 3.2)]}})
    p = out_dir / "roads_nagpur_DEMO.geojson"
    p.write_text(json.dumps({"type": "FeatureCollection", "name": "roads_demo", "features": feats}), encoding="utf-8")
    return _meta(
        p, dataset_id="demo-roads", name="Road network - Nagpur (synthetic demo)", data_type="roads",
        source="Synthetic radial/ring road network (OpenStreetMap-style GeoJSON)", collection_date="2026-01-01",
        coverage="Nagpur study area", file_format="GeoJSON",
    )


def _boundary(out_dir, sa):
    lo0, la0, lo1, la1 = sa.bbox
    gj = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"name": "Nagpur study area (rectangular, approximate)", "is_demo": True},
          "geometry": {"type": "Polygon", "coordinates": [[[lo0, la0], [lo1, la0], [lo1, la1], [lo0, la1], [lo0, la0]]]}}]}
    p = out_dir / "nagpur_study_area_boundary.geojson"
    p.write_text(json.dumps(gj), encoding="utf-8")
    return _meta(
        p, dataset_id="demo-boundary", name="Nagpur study area boundary", data_type="boundary",
        source="Rectangular analysis extent defined for this project", collection_date="2026-01-01",
        coverage="78.96-79.20 E, 21.04-21.24 N", file_format="GeoJSON",
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    for item in generate_demo_datasets(force=True):
        print(item["dataset_id"], "->", item["name"])
