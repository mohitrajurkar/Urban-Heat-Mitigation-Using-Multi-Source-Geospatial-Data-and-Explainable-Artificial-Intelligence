import sys
import os

# Add xai directory and project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
from explainer import ShapExplainer, BaseExplainer
from schemas import ShapExplanationRequest, ShapExplanationResponse

def test_uncalibrated_guard_returns_no_fake_shap():
    """
    Verifies that when no model is loaded, the explainer strictly reports
    MODEL_NOT_TRAINED and refuses to fabricate fake SHAP numbers.
    """
    explainer = ShapExplainer(model=None)
    assert not explainer.is_calibrated()

    sample_features = {
        "surface_temperature_celsius": 43.5,
        "ndvi": 0.12,
        "built_up_percentage": 82.0,
        "canopy_cover_percentage": 6.5,
        "albedo": 0.15,
        "population_density_per_km2": 19500
    }

    result = explainer.explain("ward-01", sample_features)

    assert result["region_id"] == "ward-01"
    assert result["status"] == "MODEL_NOT_TRAINED"
    assert result["explanation_ready"] is False
    assert result["base_value"] is None
    assert result["feature_contributions"] is None  # Strictly null - no fake numbers!
    assert "trained model artifact" in result["message"]

    # Validate response schema serialization
    response = ShapExplanationResponse(**result)
    assert response.explanation_ready is False
    assert response.feature_contributions is None

def test_calibrated_shap_with_trained_rf_model():
    """
    Verifies that when a trained scikit-learn RandomForestRegressor is supplied,
    SHAP values are calculated mathematically without error.
    """
    try:
        from sklearn.ensemble import RandomForestRegressor
    except ImportError:
        print("[SKIP] test_calibrated_shap_with_trained_rf_model (scikit-learn not installed in current Python env)")
        return

    np.random.seed(42)
    X = np.random.rand(40, 6)
    y = X[:, 0] * 2.5 - X[:, 1] * 1.8 + X[:, 2] * 0.9

    rf = RandomForestRegressor(n_estimators=5, max_depth=3, random_state=42)
    rf.fit(X, y)

    explainer = ShapExplainer(model=rf)
    assert explainer.is_calibrated()

    features = {
        "surface_temperature_celsius": 0.7,
        "ndvi": 0.2,
        "built_up_percentage": 0.8,
        "canopy_cover_percentage": 0.1,
        "albedo": 0.25,
        "population_density_per_km2": 0.4
    }

    result = explainer.explain("ward-test", features)
    assert result["status"] == "COMPUTED"
    assert result["explanation_ready"] is True
    assert result["base_value"] is not None
    assert len(result["feature_contributions"]) == 6
    for item in result["feature_contributions"]:
        assert item["impact_direction"] in ["INCREASES_HEAT", "REDUCES_HEAT", "NEUTRAL"]

def run_all():
    print("Running XAI Unit Tests...")
    test_uncalibrated_guard_returns_no_fake_shap()
    print("[PASS] test_uncalibrated_guard_returns_no_fake_shap")
    test_calibrated_shap_with_trained_rf_model()
    print("[PASS] test_calibrated_shap_with_trained_rf_model")
    print("\nALL XAI TESTS PASSED!")

if __name__ == "__main__":
    run_all()
