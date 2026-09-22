from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class HeatSeverityPredictionRequest(BaseModel):
    region_id: str = Field(..., description="Unique ward or grid cell identifier")
    surface_temperature_celsius: float = Field(..., ge=-20.0, le=70.0)
    ndvi: float = Field(..., ge=-1.0, le=1.0)
    built_up_percentage: float = Field(..., ge=0.0, le=100.0)
    canopy_cover_percentage: float = Field(..., ge=0.0, le=100.0)
    albedo: float = Field(..., ge=0.0, le=1.0)
    population_density_per_km2: float = Field(..., ge=0.0)

class HeatSeverityPredictionResponse(BaseModel):
    region_id: str
    predicted_heat_severity_score: float = Field(..., description="Normalized score 0 - 100")
    predicted_severity_level: str = Field(..., description="LOW, MODERATE, HIGH, CRITICAL")
    confidence_interval: Optional[List[float]] = None
    model_version: str
    model_status: str = Field(..., description="E.g. TRAINED, HEURISTIC_BASELINE, CALIBRATION_REQUIRED")
    model_details: Dict[str, Any] = Field(default_factory=dict)

class CoolingImpactPredictionRequest(BaseModel):
    region_id: str
    strategy_id: str = Field(..., description="E.g., cool-roofs, urban-tree-plantation, green-roofs")
    coverage_percentage: float = Field(..., ge=0.0, le=100.0)
    baseline_temperature_celsius: float
    baseline_ndvi: float
    baseline_built_up_percentage: float

class CoolingImpactPredictionResponse(BaseModel):
    region_id: str
    strategy_id: str
    coverage_percentage: float
    predicted_temp_reduction_celsius: float
    predicted_new_temperature_celsius: float
    model_status: str
    model_version: str
