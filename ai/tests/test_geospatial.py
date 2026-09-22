from app.geospatial.preprocessor import GeospatialPreprocessor

def test_calculate_ndvi_dense_vegetation():
    # Dense vegetation: high NIR (~0.8), low Red (~0.1)
    nir = [[0.8, 0.85], [0.75, 0.9]]
    red = [[0.1, 0.12], [0.08, 0.1]]
    res = GeospatialPreprocessor.calculate_ndvi(nir, red)

    assert res["mean_ndvi"] > 0.7
    assert res["vegetation_density_category"] == "DENSE_VEGETATION"
    assert res["grid_shape"] == [2, 2]

def test_calculate_ndvi_water_body():
    # Water: low NIR (~0.05), higher Red (~0.15) -> negative NDVI
    nir = [[0.05, 0.04], [0.03, 0.05]]
    red = [[0.15, 0.14], [0.12, 0.16]]
    res = GeospatialPreprocessor.calculate_ndvi(nir, red)

    assert res["mean_ndvi"] < 0.0
    assert res["vegetation_density_category"] == "WATER_BODY"

def test_calculate_ndbi():
    # Built-up: SWIR > NIR -> positive NDBI
    swir = [[0.6, 0.55], [0.5, 0.65]]
    nir = [[0.2, 0.25], [0.18, 0.22]]
    res = GeospatialPreprocessor.calculate_ndbi(swir, nir)

    assert res["mean_ndbi"] > 0.0
    assert "ndbi_matrix" in res

def test_calculate_land_surface_temperature():
    # Brightness temp in Kelvin (315 K ~ 41.85 C)
    bt = [[315.0, 316.0], [314.5, 315.5]]
    ndvi = [[0.1, 0.15], [0.12, 0.14]]
    res = GeospatialPreprocessor.calculate_land_surface_temperature(bt, ndvi)

    assert "mean_lst_celsius" in res
    assert res["mean_lst_celsius"] > 35.0
    assert res["heat_stress_category"] in ["SEVERE_HEAT_STRESS", "EXTREME_HEAT_STRESS"]

def test_dimension_mismatch_raises():
    nir = [[0.5, 0.5]]
    red = [[0.1, 0.1], [0.1, 0.1]]
    raised = False
    try:
        GeospatialPreprocessor.calculate_ndvi(nir, red)
    except ValueError:
        raised = True
    assert raised, "Expected ValueError on dimension mismatch"
