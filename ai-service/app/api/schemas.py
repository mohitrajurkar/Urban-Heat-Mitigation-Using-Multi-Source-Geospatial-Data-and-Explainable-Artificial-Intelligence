"""Pydantic request models for the AI service API."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class DatasetSelection(BaseModel):
    landsat: str = Field(..., description="Dataset id of a Landsat 8/9 stack (required - thermal band)")
    sentinel2: Optional[str] = None
    lulc: Optional[str] = None
    meteorological: Optional[str] = None
    population: Optional[str] = None
    roads: Optional[str] = None


class PreprocessRequest(BaseModel):
    study_area: str = Field("nagpur", examples=["nagpur"])
    datasets: Optional[DatasetSelection] = Field(None, description="Omit to use the bundled Nagpur demonstration datasets")
    resolution_m: Optional[int] = Field(None, ge=30, le=500)
    cell_size_m: Optional[int] = Field(None, ge=200, le=5000)
    run_id: Optional[str] = Field(None, pattern=r"^[A-Za-z0-9_-]{4,64}$")


class RunRequest(BaseModel):
    run_id: str = Field(..., pattern=r"^[A-Za-z0-9_-]{4,64}$")


class TrainParams(BaseModel):
    n_estimators: int = Field(200, ge=20, le=1000)
    max_depth: Optional[int] = Field(None, ge=2, le=30)
    learning_rate: float = Field(0.06, gt=0, le=1)
    test_size: float = Field(0.25, ge=0.1, le=0.5)


class TrainRequest(RunRequest):
    params: TrainParams = TrainParams()


class FeatureSample(BaseModel):
    ndvi_mean: Optional[float] = Field(None, ge=-1, le=1)
    ndbi_mean: Optional[float] = Field(None, ge=-1, le=1)
    ndwi_mean: Optional[float] = Field(None, ge=-1, le=1)
    albedo_mean: Optional[float] = Field(None, ge=0, le=1)
    built_fraction: Optional[float] = Field(None, ge=0, le=1)
    vegetation_fraction: Optional[float] = Field(None, ge=0, le=1)
    water_fraction: Optional[float] = Field(None, ge=0, le=1)
    open_land_fraction: Optional[float] = Field(None, ge=0, le=1)
    air_temp_max: Optional[float] = Field(None, ge=-10, le=55)
    relative_humidity: Optional[float] = Field(None, ge=0, le=100)
    wind_speed: Optional[float] = Field(None, ge=0, le=40)
    population_density: Optional[float] = Field(None, ge=0, le=200000)
    road_density: Optional[float] = Field(None, ge=0, le=100)


class PredictRequest(BaseModel):
    run_id: Optional[str] = Field(None, pattern=r"^[A-Za-z0-9_-]{4,64}$")
    features: Optional[list[FeatureSample]] = Field(None, description="Custom feature vectors; omit to predict all regions of run_id")

    @field_validator("features")
    @classmethod
    def _limit(cls, v):
        if v is not None and not 1 <= len(v) <= 500:
            raise ValueError("features must contain 1-500 samples")
        return v


class RecommendationRequest(RunRequest):
    overrides: Optional[dict[str, Any]] = Field(None, description="Optional {strategies: {...}, priority_weights: {...}} overrides")


class PipelineRequest(PreprocessRequest):
    params: TrainParams = TrainParams()
    overrides: Optional[dict[str, Any]] = None
