import numpy as np
import pytest

from app.features import indices


def test_ndvi_formula_and_division_by_zero():
    nir = np.array([0.5, 0.3, 0.0, np.nan])
    red = np.array([0.1, 0.3, 0.0, 0.2])
    out = indices.ndvi(nir, red)
    assert out[0] == pytest.approx((0.5 - 0.1) / (0.5 + 0.1))
    assert out[1] == pytest.approx(0.0)
    assert np.isnan(out[2])  # 0 / 0 -> NaN, not an exception
    assert np.isnan(out[3])  # missing input propagates


def test_ndbi_and_ndwi_signs():
    # built-up surface: SWIR > NIR -> positive NDBI; water: green > NIR -> positive NDWI
    assert indices.ndbi(np.array([0.3]), np.array([0.2]))[0] > 0
    assert indices.ndwi(np.array([0.08]), np.array([0.02]))[0] > 0
    assert indices.ndwi(np.array([0.06]), np.array([0.42]))[0] < 0  # vegetation


def test_toa_reflectance_masks_fill_values():
    dn = np.array([0.0, 20000.0])
    rho = indices.dn_to_toa_reflectance(dn, 2e-5, -0.1, 60.0)
    assert np.isnan(rho[0])
    assert rho[1] == pytest.approx((2e-5 * 20000 - 0.1) / np.sin(np.radians(60)))


def test_lst_retrieval_inverts_exactly():
    lst = np.array([30.0, 42.5, 48.0])
    eps = np.array([0.991, 0.973, 0.986])
    bt = indices.brightness_temperature_from_lst(lst, eps)
    assert np.all(bt < lst + 273.15)  # emissivity < 1 -> BT below kinetic temperature
    np.testing.assert_allclose(indices.land_surface_temperature(bt, eps), lst, atol=1e-9)


def test_full_thermal_chain_round_trip():
    k1, k2, ml, al = 774.8853, 1321.0789, 3.342e-4, 0.1
    bt = 315.0
    rad = k1 / (np.exp(k2 / bt) - 1)
    dn = (rad - al) / ml
    out = indices.radiance_to_brightness_temperature(indices.dn_to_radiance(np.array([dn]), ml, al), k1, k2)
    assert out[0] == pytest.approx(bt, abs=1e-6)


def test_emissivity_thresholds():
    ndvi = np.array([-0.1, 0.1, 0.35, 0.7])
    eps = indices.emissivity_from_ndvi(ndvi)
    assert eps[0] == pytest.approx(0.991)
    assert eps[1] == pytest.approx(0.973)
    assert 0.986 < eps[2] < 0.990
    assert eps[3] == pytest.approx(0.990)


def test_albedo_range_and_lulc_fallback():
    alb = indices.surface_albedo_landsat(0.1, 0.15, 0.25, 0.3, 0.25)
    assert 0.1 < float(alb) < 0.3
    lulc = indices.classify_lulc_from_indices(np.array([0.6, -0.2, 0.05]), np.array([-0.2, -0.3, 0.2]), np.array([-0.5, 0.3, -0.2]))
    assert list(lulc) == [2, 1, 7]
