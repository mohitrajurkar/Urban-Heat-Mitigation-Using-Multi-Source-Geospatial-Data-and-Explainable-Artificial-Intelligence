from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert "subsystems" in data
    assert data["subsystems"]["geospatial"] == "READY"

def test_status_endpoint():
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    data = response.json()
    assert "geospatial_preprocessor" in data
    assert "ml_engine" in data
    assert "explainable_ai" in data

def test_predict_heat_severity():
    payload = {
        "region_id": "ward-nagpur-center",
        "surface_temperature_celsius": 43.5,
        "ndvi": 0.12,
        "built_up_percentage": 82.0,
        "canopy_cover_percentage": 7.0,
        "albedo": 0.14,
        "population_density_per_km2": 21000
    }
    response = client.post("/api/v1/predict/heat-severity", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["region_id"] == "ward-nagpur-center"
    assert "predicted_heat_severity_score" in data
    assert data["predicted_severity_level"] in ["CRITICAL", "HIGH", "MODERATE", "LOW"]

def test_predict_cooling_impact():
    payload = {
        "region_id": "ward-nagpur-center",
        "strategy_id": "cool-roofs",
        "coverage_percentage": 40.0,
        "baseline_temperature_celsius": 43.5,
        "baseline_ndvi": 0.12,
        "baseline_built_up_percentage": 82.0
    }
    response = client.post("/api/v1/predict/cooling-impact", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_temp_reduction_celsius"] > 0
    assert data["predicted_new_temperature_celsius"] < payload["baseline_temperature_celsius"]

def test_explain_shap_uncalibrated():
    payload = {
        "region_id": "ward-01",
        "feature_vector": {
            "surface_temperature_celsius": 43.5,
            "ndvi": 0.12,
            "built_up_percentage": 82.0,
            "canopy_cover_percentage": 7.0,
            "albedo": 0.14,
            "population_density_per_km2": 21000
        }
    }
    response = client.post("/api/v1/explain/shap", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "MODEL_NOT_TRAINED"
    assert data["explanation_ready"] is False
    assert data["feature_contributions"] is None
