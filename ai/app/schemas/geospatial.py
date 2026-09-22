from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class BoundingBox(BaseModel):
    min_lat: float = Field(..., description="Minimum latitude (South)")
    min_lon: float = Field(..., description="Minimum longitude (West)")
    max_lat: float = Field(..., description="Maximum latitude (North)")
    max_lon: float = Field(..., description="Maximum longitude (East)")

class NdviCalculationRequest(BaseModel):
    nir_band: List[List[float]] = Field(..., description="Near-Infrared band reflectance matrix (values typically 0.0 - 1.0)")
    red_band: List[List[float]] = Field(..., description="Red band reflectance matrix (values typically 0.0 - 1.0)")

class NdviCalculationResponse(BaseModel):
    mean_ndvi: float
    min_ndvi: float
    max_ndvi: float
    vegetation_density_category: str
    grid_shape: List[int]

class LstCalculationRequest(BaseModel):
    tir_brightness_temp_kelvin: List[List[float]] = Field(..., description="Thermal infrared top-of-atmosphere brightness temp (Kelvin)")
    ndvi_matrix: Optional[List[List[float]]] = Field(None, description="NDVI matrix for land surface emissivity estimation")

class LstCalculationResponse(BaseModel):
    mean_lst_celsius: float
    min_lst_celsius: float
    max_lst_celsius: float
    heat_stress_category: str

class GeospatialFeatureSummary(BaseModel):
    region_id: str
    region_name: Optional[str] = None
    bounding_box: Optional[BoundingBox] = None
    mean_surface_temp_celsius: float
    mean_ndvi: float
    mean_ndbi: float
    built_up_percentage: float
    canopy_cover_percentage: float
    water_body_percentage: float
    metadata: Dict[str, Any] = Field(default_factory=dict)
