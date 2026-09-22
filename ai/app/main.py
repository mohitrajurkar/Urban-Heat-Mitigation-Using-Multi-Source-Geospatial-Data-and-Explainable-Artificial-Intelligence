import os
import time
from typing import Dict, Any
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .schemas.geospatial import (
    NdviCalculationRequest,
    NdviCalculationResponse,
    LstCalculationRequest,
    LstCalculationResponse
)
from .schemas.prediction import (
    HeatSeverityPredictionRequest,
    HeatSeverityPredictionResponse,
    CoolingImpactPredictionRequest,
    CoolingImpactPredictionResponse
)
from .schemas.explainability import (
    ShapExplanationRequest,
    ShapExplanationResponse
)
from .geospatial.preprocessor import GeospatialPreprocessor
from .ml.predictor import HeatSeverityPredictor, CoolingImpactPredictor
import sys
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
_xai_dir = os.path.join(_project_root, "xai")
if _xai_dir not in sys.path:
    sys.path.insert(0, _xai_dir)

try:
    from xai.explainer import ShapExplainer
except ImportError:
    from explainer import ShapExplainer

# Initialize FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=(
        "Microservice for Urban Heat Island (UHI) AI analysis: "
        "geospatial raster preprocessing, machine learning heat prediction, "
        "and Explainable AI (XAI) using SHAP."
    ),
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS setup for frontend / backend communication
app.use_cors = True
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singleton instances
ml_predictor = HeatSeverityPredictor(model_dir=settings.model_dir)
cooling_predictor = CoolingImpactPredictor()
shap_explainer = ShapExplainer(model=ml_predictor.model)


@app.get("/health", tags=["System"])
def health_check() -> Dict[str, Any]:
    """Health check endpoint for container orchestrators and Spring Boot backend."""
    return {
        "status": "UP",
        "service": settings.app_name,
        "version": settings.version,
        "timestamp": time.time(),
        "environment": settings.environment,
        "subsystems": {
            "geospatial": "READY",
            "ml_prediction": "TRAINED" if ml_predictor.is_trained() else "HEURISTIC_BASELINE",
            "explainability_shap": "CALIBRATED" if shap_explainer.is_calibrated() else "MODEL_NOT_TRAINED"
        }
    }


@app.get("/api/v1/status", tags=["System"])
def system_status() -> Dict[str, Any]:
    """Detailed capability status of AI, Geospatial, and XAI engines."""
    return {
        "ai_service_version": settings.version,
        "geospatial_preprocessor": {
            "status": "ACTIVE",
            "supported_indices": ["NDVI", "NDBI", "LST_Sobrino"]
        },
        "ml_engine": {
            "is_trained": ml_predictor.is_trained(),
            "model_version": ml_predictor.model_version,
            "supported_interventions": list(CoolingImpactPredictor.STRATEGY_MAX_COOLING.keys())
        },
        "explainable_ai": {
            "engine": "SHAP (SHapley Additive exPlanations)",
            "is_calibrated": shap_explainer.is_calibrated(),
            "requires_model_checkpoint": True,
            "synthetic_values_allowed": False
        }
    }


# =====================================================================
# Geospatial Preprocessing Endpoints
# =====================================================================

@app.post("/api/v1/geospatial/ndvi", response_model=NdviCalculationResponse, tags=["Geospatial Preprocessing"])
def calculate_ndvi(request: NdviCalculationRequest):
    """
    Computes Normalized Difference Vegetation Index (NDVI) from Near-Infrared (NIR)
    and Red spectral bands matrix.
    """
    try:
        result = GeospatialPreprocessor.calculate_ndvi(request.nir_band, request.red_band)
        return NdviCalculationResponse(
            mean_ndvi=result["mean_ndvi"],
            min_ndvi=result["min_ndvi"],
            max_ndvi=result["max_ndvi"],
            vegetation_density_category=result["vegetation_density_category"],
            grid_shape=result["grid_shape"]
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@app.post("/api/v1/geospatial/lst", response_model=LstCalculationResponse, tags=["Geospatial Preprocessing"])
def calculate_land_surface_temperature(request: LstCalculationRequest):
    """
    Derives Land Surface Temperature (LST) in Celsius from thermal infrared brightness temp
    using split-window or single-channel emissivity correction.
    """
    try:
        result = GeospatialPreprocessor.calculate_land_surface_temperature(
            request.tir_brightness_temp_kelvin,
            request.ndvi_matrix
        )
        return LstCalculationResponse(
            mean_lst_celsius=result["mean_lst_celsius"],
            min_lst_celsius=result["min_lst_celsius"],
            max_lst_celsius=result["max_lst_celsius"],
            heat_stress_category=result["heat_stress_category"]
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# =====================================================================
# ML Prediction Endpoints
# =====================================================================

@app.post("/api/v1/predict/heat-severity", response_model=HeatSeverityPredictionResponse, tags=["ML Prediction"])
def predict_heat_severity(request: HeatSeverityPredictionRequest):
    """
    Predicts normalized Heat Severity score (0-100) and priority level
    from surface temperature, NDVI, built-up %, canopy cover, and demographic exposure.
    """
    return ml_predictor.predict(request)


@app.post("/api/v1/predict/cooling-impact", response_model=CoolingImpactPredictionResponse, tags=["ML Prediction"])
def predict_cooling_impact(request: CoolingImpactPredictionRequest):
    """
    Simulates thermal cooling impact (expected Delta T) for a selected heat mitigation strategy
    given the specified coverage percentage.
    """
    return cooling_predictor.predict(request)


# =====================================================================
# Explainable AI (XAI) Endpoints
# =====================================================================

@app.post("/api/v1/explain/shap", response_model=ShapExplanationResponse, tags=["Explainable AI (SHAP)"])
def explain_with_shap(request: ShapExplanationRequest):
    """
    Calculates Shapley feature importance values for a target region/ward.
    Note: If no trained ML checkpoint is loaded, strictly returns MODEL_NOT_TRAINED
    with explanation_ready=False rather than fabricating artificial numbers.
    """
    res = shap_explainer.explain(request.region_id, request.feature_vector)
    return ShapExplanationResponse(**res)


@app.get("/api/v1/explain/status", tags=["Explainable AI (SHAP)"])
def explain_status() -> Dict[str, Any]:
    """Status of Explainable AI subsystem."""
    return {
        "xai_engine": "SHAP",
        "is_calibrated": shap_explainer.is_calibrated(),
        "ready": shap_explainer.is_calibrated(),
        "feature_order": ShapExplainer.FEATURE_ORDER
    }
