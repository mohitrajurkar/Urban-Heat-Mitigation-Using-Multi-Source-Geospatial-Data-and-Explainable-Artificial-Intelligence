from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class FeatureContribution(BaseModel):
    feature_name: str
    feature_value: float
    shap_value: float = Field(..., description="Marginal game-theoretic contribution to model prediction")
    impact_direction: str = Field(..., description="INCREASES_HEAT, REDUCES_HEAT, or NEUTRAL")

class ShapExplanationRequest(BaseModel):
    region_id: str = Field(..., description="Target ward or grid cell identifier")
    feature_vector: Dict[str, float] = Field(
        ...,
        description="Feature dictionary mapping feature names to numerical values"
    )
    model_name: Optional[str] = "heat_severity_regressor"

class ShapExplanationResponse(BaseModel):
    region_id: str
    status: str = Field(
        ...,
        description="COMPUTED, MODEL_NOT_TRAINED, or COMPUTATION_ERROR"
    )
    explanation_ready: bool
    base_value: Optional[float] = Field(
        None,
        description="Expected model output baseline E[f(x)] over training dataset"
    )
    feature_contributions: Optional[List[FeatureContribution]] = Field(
        None,
        description="Genuine SHAP feature contributions. Strictly null when model is uncalibrated."
    )
    message: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
