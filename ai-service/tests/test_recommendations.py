from app.recommendations.engine import load_config, recommend_for_region
from app.recommendations.priority import combined_cooling, priority_level, score_regions

CELL_M2 = 250_000.0


def _region(**kw):
    base = {"built_fraction": 0.7, "open_land_fraction": 0.05, "ndvi_mean": 0.12, "albedo_mean": 0.17, "ndbi_mean": 0.08,
            "ndwi_mean": -0.3, "water_fraction": 0.0, "road_density": 8.0, "population_density": 15000, "vegetation_fraction": 0.05}
    base.update(kw)
    return base


def test_dense_built_area_gets_roofs_pavements_trees():
    recs = recommend_for_region(_region(), load_config(), CELL_M2)
    types = {r["type"] for r in recs}
    assert {"cool_roofs", "cool_pavements", "tree_plantation"} <= types
    assert "urban_forest" not in types  # not enough open land
    for r in recs:
        assert r["cost_inr"] > 0 and 0 < r["cooling_c"] <= load_config()["strategies"][r["type"]]["max_cooling_c"]
        assert r["cost_low_inr"] < r["cost_inr"] < r["cost_high_inr"]
        assert r["reason"]


def test_open_periurban_land_gets_forest_and_water():
    recs = recommend_for_region(_region(built_fraction=0.3, open_land_fraction=0.45, ndwi_mean=-0.35), load_config(), CELL_M2)
    types = {r["type"] for r in recs}
    assert "urban_forest" in types and "water_bodies" in types


def test_green_area_gets_nothing():
    recs = recommend_for_region(_region(built_fraction=0.05, open_land_fraction=0.0, ndvi_mean=0.6, vegetation_fraction=0.9), load_config(), CELL_M2)
    assert recs == []


def test_cost_formula_matches_configuration():
    cfg = load_config()
    rec = next(r for r in recommend_for_region(_region(), cfg, CELL_M2) if r["type"] == "cool_roofs")
    s = cfg["strategies"]["cool_roofs"]
    expected_area = CELL_M2 * 0.7 * s["roof_share_of_built"] * s["adoption_rate"]
    assert abs(rec["area_m2"] - expected_area) < 1e-6
    assert abs(rec["cost_inr"] - expected_area * s["unit_cost_inr"]) < 1e-3


def test_overrides_change_costs():
    cfg = load_config({"strategies": {"cool_roofs": {"unit_cost_inr": 700}}})
    assert cfg["strategies"]["cool_roofs"]["unit_cost_inr"] == 700
    assert load_config()["strategies"]["cool_roofs"]["unit_cost_inr"] != 700


def test_priority_score_is_weighted_sum():
    cfg = load_config()
    hotspots = [
        {"cell_index": 0, "region_code": "A", "name": "A", "locality": "X", "severity": "Very High", "lst": 48.0, "is_hotspot": True},
        {"cell_index": 1, "region_code": "B", "name": "B", "locality": "X", "severity": "High", "lst": 44.0, "is_hotspot": True},
        {"cell_index": 2, "region_code": "C", "name": "C", "locality": "X", "severity": "Low", "lst": 36.0, "is_hotspot": False},
    ]
    regions = {0: _region(), 1: _region(population_density=2000, ndvi_mean=0.25), 2: _region()}
    recs = {0: recommend_for_region(regions[0], cfg, CELL_M2), 1: recommend_for_region(regions[1], cfg, CELL_M2)}
    ranks = score_regions(hotspots, regions, recs, cfg)
    assert [r["region_code"] for r in ranks] == ["A", "B"]
    top = ranks[0]
    assert abs(top["score"] - sum(top["contributions"].values())) < 0.05
    assert top["priority_level"] == priority_level(top["score"], cfg["priority_levels"])
    assert combined_cooling([]) == 0.0
