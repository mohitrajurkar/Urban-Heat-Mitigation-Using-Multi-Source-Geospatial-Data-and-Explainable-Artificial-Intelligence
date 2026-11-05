"""End-to-end API test: every documented endpoint on the bundled demonstration dataset."""
import io

import numpy as np
import pytest


@pytest.fixture(scope="module")
def run_id(client):
    r = client.post("/data/preprocess", json={"study_area": "nagpur"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["report"]["landsat"]["valid_pixel_pct"] > 90
    return body["run_id"]


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "UP"
    assert r.json()["demo_datasets_available"] is True


def test_dataset_catalog_is_labelled_demo(client):
    items = client.get("/datasets").json()
    ids = {d["dataset_id"] for d in items}
    assert {"demo-landsat9", "demo-lulc", "demo-meteo", "demo-population", "demo-roads", "demo-sentinel2"} <= ids
    assert all(d["is_demo"] and not d["is_real"] for d in items if d["dataset_id"].startswith("demo-"))


def test_upload_validation_and_delete(client):
    csv = b"station_id,latitude,longitude,date,air_temp_max_c\nS1,21.1,79.0,2026-04-01,41.2\n"
    r = client.post("/data/upload", files={"file": ("met.csv", io.BytesIO(csv), "text/csv")}, data={"data_type": "meteorological", "name": "Test met"})
    assert r.status_code == 200, r.text
    ds = r.json()
    assert ds["dataset_id"].startswith("ds-") and ds["inspection"]["rows_previewed"] == 1
    bad = client.post("/data/upload", files={"file": ("x.csv", io.BytesIO(b"a,b\n1,2\n"), "text/csv")}, data={"data_type": "meteorological"})
    assert bad.status_code == 400 and "missing required columns" in bad.json()["message"]
    wrong_ext = client.post("/data/upload", files={"file": ("x.txt", io.BytesIO(b"hi"), "text/plain")}, data={"data_type": "landsat"})
    assert wrong_ext.status_code == 400
    assert client.delete(f"/datasets/{ds['dataset_id']}").status_code == 200
    assert client.delete("/datasets/demo-landsat9").status_code == 400


def test_full_pipeline(client, run_id):
    fe = client.post("/features/extract", json={"run_id": run_id})
    assert fe.status_code == 200, fe.text
    regions = fe.json()["regions"]
    assert len(regions) > 1000
    lst = np.array([r["lst_mean"] for r in regions if r["lst_mean"] is not None])
    assert 25 < lst.min() and lst.max() < 55  # physically plausible pre-monsoon LST
    assert set(fe.json()["layers"]) >= {"lst", "ndvi", "ndbi", "ndwi", "albedo", "lulc"}
    assert client.get(f"/layers/{run_id}/lst.png").headers["content-type"] == "image/png"

    ev = client.post("/model/train", json={"run_id": run_id, "params": {"n_estimators": 60}})
    assert ev.status_code == 200, ev.text
    e = ev.json()
    assert "lst_mean" not in e["features"]  # leakage control
    for model in ("random_forest", "xgboost"):
        cls, reg = e["models"][model]["classification"], e["models"][model]["regression"]
        assert 0.4 < cls["accuracy"] <= 1 and len(cls["confusion_matrix"]) == 4
        assert reg["r2"] > 0.5 and reg["rmse"] > 0
    assert client.get("/model/evaluation", params={"run_id": run_id}).json()["run_id"] == run_id

    pr = client.post("/model/predict", json={"run_id": run_id})
    assert pr.status_code == 200 and len(pr.json()["predictions"]) == len(regions)

    custom = client.post("/model/predict", json={"run_id": run_id, "features": [{"ndvi_mean": 0.08, "ndbi_mean": 0.15, "built_fraction": 0.9}]})
    assert custom.status_code == 200 and custom.json()["results"][0]["models"]["xgboost"]["predicted_class"]

    sh = client.post("/explain/shap", json={"run_id": run_id})
    assert sh.status_code == 200, sh.text
    loc = sh.json()["local"][0]
    # SHAP additivity: base value + sum of contributions == model prediction
    assert abs(loc["base_value"] + sum(c["shap"] for c in loc["contributions"]) - loc["predicted_value"]) < 1e-3
    assert loc["explanation"].startswith(regions[0]["name"])
    assert client.get(f"/explain/plot/{run_id}/summary_xgboost_regression.png").status_code == 200

    hot_vs_cool = client.post("/explain/shap", json={"run_id": run_id, "features": [
        {"ndvi_mean": 0.05, "ndbi_mean": 0.16, "built_fraction": 0.95, "vegetation_fraction": 0.0, "albedo_mean": 0.16},
        {"ndvi_mean": 0.7, "ndbi_mean": -0.3, "built_fraction": 0.0, "vegetation_fraction": 0.95, "albedo_mean": 0.12}]}).json()["results"]
    assert hot_vs_cool[0]["predicted_value"] > hot_vs_cool[1]["predicted_value"]

    hs = client.post("/hotspots/detect", json={"run_id": run_id})
    assert hs.status_code == 200
    assert hs.json()["summary"]["n_hotspots"] == len(hs.json()["hotspots"]) > 0

    rec = client.post("/recommendations/generate", json={"run_id": run_id, "overrides": {"priority_weights": {"heat_severity": 1.0}}})
    assert rec.status_code == 200, rec.text
    body = rec.json()
    assert body["summary"]["n_recommendations"] > 0
    assert {r["type"] for r in body["recommendations"]} <= {"tree_plantation", "urban_forest", "cool_roofs", "cool_pavements", "water_bodies"}
    ranks = body["rankings"]
    assert [r["rank"] for r in ranks] == list(range(1, len(ranks) + 1))
    assert all(ranks[i]["score"] >= ranks[i + 1]["score"] for i in range(len(ranks) - 1))


def test_errors_are_clean_json(client):
    r = client.post("/features/extract", json={"run_id": "run_doesnotexist"})
    assert r.status_code == 404 and "not found" in r.json()["message"]
    r = client.post("/model/train", json={"run_id": "x"})
    assert r.status_code == 422
