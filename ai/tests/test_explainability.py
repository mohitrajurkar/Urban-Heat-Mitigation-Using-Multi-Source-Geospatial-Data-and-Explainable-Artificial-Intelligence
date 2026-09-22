import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import numpy as np
from xai.explainer import ShapExplainer, BaseExplainer

def test_shap_explainer_uncalibrated_guard():
    """
    Verifies that when no trained model is loaded, the explainer strictly returns
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

    # Validate strict guard contract
    assert result["region_id"] == "ward-01"
    assert result["status"] == "MODEL_NOT_TRAINED"
    assert result["explanation_ready"] is False
    assert result["base_value"] is None
    assert result["feature_contributions"] is None  # Must NOT contain fake numbers
    assert "trained model artifact" in result["message"]

def test_shap_explainer_with_mock_trained_model():
    """
    Verifies that if a trained scikit-learn model is supplied, the explainer
    initializes real SHAP and calculates genuine feature attributions.
    """
    try:
        from sklearn.ensemble import RandomForestRegressor
    except ImportError:
        print("[SKIP] test_shap_explainer_with_mock_trained_model (scikit-learn not installed)")
        return

    # Generate small synthetic dataset for testing explainer initialization
    np.random.seed(42)
    X = np.random.rand(50, 6)
    y = X[:, 0] * 3.0 - X[:, 1] * 2.0 + X[:, 2] * 1.5

    rf = RandomForestRegressor(n_estimators=5, max_depth=3, random_state=42)
    rf.fit(X, y)

    explainer = ShapExplainer(model=rf)
    assert explainer.is_calibrated()

    feature_dict = {
        "surface_temperature_celsius": 0.8,
        "ndvi": 0.2,
        "built_up_percentage": 0.7,
        "canopy_cover_percentage": 0.1,
        "albedo": 0.3,
        "population_density_per_km2": 0.5
    }

    res = explainer.explain("test-zone", feature_dict)
    assert res["status"] == "COMPUTED"
    assert res["explanation_ready"] is True
    assert res["base_value"] is not None
    assert len(res["feature_contributions"]) == 6
    for item in res["feature_contributions"]:
        assert "feature_name" in item
        assert "shap_value" in item
        assert item["impact_direction"] in ["INCREASES_HEAT", "REDUCES_HEAT", "NEUTRAL"]
