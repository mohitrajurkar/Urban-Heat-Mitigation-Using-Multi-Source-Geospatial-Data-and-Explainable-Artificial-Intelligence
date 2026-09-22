import sys
import os

# Add parent directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.test_geospatial import (
    test_calculate_ndvi_dense_vegetation,
    test_calculate_ndvi_water_body,
    test_calculate_ndbi,
    test_calculate_land_surface_temperature,
    test_dimension_mismatch_raises
)
from tests.test_explainability import test_shap_explainer_uncalibrated_guard
from tests.test_api import (
    test_health_endpoint,
    test_status_endpoint,
    test_predict_heat_severity,
    test_predict_cooling_impact,
    test_explain_shap_uncalibrated
)

def run_all():
    print("Running AI Service Unit Tests...")
    test_calculate_ndvi_dense_vegetation()
    print("[PASS] test_calculate_ndvi_dense_vegetation")
    test_calculate_ndvi_water_body()
    print("[PASS] test_calculate_ndvi_water_body")
    test_calculate_ndbi()
    print("[PASS] test_calculate_ndbi")
    test_calculate_land_surface_temperature()
    print("[PASS] test_calculate_land_surface_temperature")
    test_dimension_mismatch_raises()
    print("[PASS] test_dimension_mismatch_raises")
    test_shap_explainer_uncalibrated_guard()
    print("[PASS] test_shap_explainer_uncalibrated_guard")
    test_health_endpoint()
    print("[PASS] test_health_endpoint")
    test_status_endpoint()
    print("[PASS] test_status_endpoint")
    test_predict_heat_severity()
    print("[PASS] test_predict_heat_severity")
    test_predict_cooling_impact()
    print("[PASS] test_predict_cooling_impact")
    test_explain_shap_uncalibrated()
    print("[PASS] test_explain_shap_uncalibrated")
    print("\nALL AI SERVICE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_all()
