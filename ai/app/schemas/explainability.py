from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class FeatureImportanceItem(BaseModel):
    feature_name: str
    feature_value: float
    shap_value: float = Field(..., description="Marginal contribution of the feature to model output")
    impact_direction: str = Field(..., description="INCREASES_HEAT, REDUCES_HEAT, NEUTRAL")

class ShapExplanationRequest(BaseModel):
    region_id: str
    feature_vector: Dict[str, float] = Field(
        ...,
        description="Feature key-value pairs (e.g., surface_temperature, ndvi, built_up_pct, canopy_cover, albedo)"
    )
    model_name: Optional[str] = "heat_severity_regressor"

class ShapExplanationResponse(BaseModel):
    region_id: str
    status: str = Field(
        ...,
        description="COMPUTED, MODEL_NOT_TRAINED, or CHECKPOINT_REQUIRED"
    )
    explanation_ready: bool
    base_value: Optional[float] = Field(
        None,
        description="Expected model output baseline E[f(x)] over training distribution"
    )
    feature_contributions: Optional[List[FeatureImportanceItem]] = Field(
        None,
        description="List of real SHAP feature contributions (only populated when a trained model is present)"
    )
    message: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
