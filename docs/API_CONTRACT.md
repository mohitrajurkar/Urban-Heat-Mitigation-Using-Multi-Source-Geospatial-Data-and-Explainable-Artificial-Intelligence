# API Contract Specification: Heat-AI

This document defines the formal REST API contracts and data exchange specifications between all Heat-AI modules.

---

## Part 1: Frontend ↔ Backend REST API (`backend/` on `:8080`)

All responses use JSON format with standard HTTP status codes (`200 OK`, `400 Bad Request`, `404 Not Found`, `500 Server Error`).

### 1.1. Health & AI Status
- **Endpoint**: `GET /api/health`
- **Response `200 OK`**:
```json
{
  "status": "UP",
  "service": "Urban Heat Mitigation Decision Support System (Spring Boot Java Backend)",
  "timestamp": "2026-09-22T15:45:00Z",
  "mode": "Prototype Mode",
  "aiServiceHealth": {
    "available": true,
    "status": "UP",
    "aiServiceUrl": "http://localhost:8000"
  },
  "notice": "Data shown for demonstration. Real satellite models integrate in Phase 2."
}
```

- **Endpoint**: `GET /api/ai-status`
- **Response `200 OK`**:
```json
{
  "success": true,
  "aiService": {
    "available": true,
    "status": "UP",
    "aiServiceUrl": "http://localhost:8000"
  }
}
```

### 1.2. Wards Data
- **Endpoint**: `GET /api/wards`
- **Description**: Returns all administrative wards with baseline thermal and socio-economic summaries.
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": "ward-01",
      "name": "Dharampeth",
      "zone": "West Zone",
      "population": 145000,
      "areaKm2": 7.2,
      "populationDensity": 20138.89,
      "metrics": {
        "surfaceTemperature": 43.2,
        "ndvi": 0.14,
        "ndbi": 0.38,
        "builtUpPercentage": 81.5,
        "canopyCoverPercentage": 7.2,
        "albedo": 0.16
      },
      "heatSeverityScore": 76.4,
      "heatSeverityLevel": "Critical",
      "priorityScore": 78.9,
      "priorityLevel": "Immediate Action",
      "primaryMitigation": "Cool Roofs (High-Albedo Reflective Coating)"
    }
  ]
}
```

- **Endpoint**: `GET /api/wards/{id}/analysis`
- **Description**: Detailed multi-criteria decision result, heat severity breakdown, vulnerability index, and recommendations for a ward.

### 1.3. Mitigation Strategies Catalog
- **Endpoint**: `GET /api/strategies`
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "id": "cool-roofs",
      "name": "Cool Roofs (High-Albedo Reflective Coating)",
      "category": "Engineering/Albedo",
      "description": "High-reflectance coatings (SRI > 100) on flat building roofs.",
      "costPerUnit": 280.0,
      "unit": "₹/m²",
      "coolingPotential": 2.1,
      "implementationSpeed": "Immediate (<3 mo)",
      "maintenanceRequirement": "Low",
      "coBenefits": "None",
      "spatialTarget": "Rooftop"
    }
  ]
}
```

### 1.4. What-If Scenario Analysis
- **Endpoint**: `POST /api/scenario/analyze`
- **Request Body**:
```json
{
  "wardId": "ward-01",
  "strategyId": "cool-roofs",
  "coveragePercentage": 50.0
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "wardId": "ward-01",
    "strategyId": "cool-roofs",
    "coveragePercentage": 50.0,
    "baselineTemperature": 43.2,
    "projectedTemperature": 41.7,
    "temperatureReduction": 1.5,
    "estimatedCost": 10080000.0,
    "peopleBenefited": 72500,
    "costPerCitizenBenefited": 139.03
  }
}
```

---

## Part 2: Backend ↔ AI Service REST API (`ai/` on `:8000`)

### 2.1. Geospatial Band Processing
- **Endpoint**: `POST /api/v1/geospatial/ndvi`
- **Request Body**:
```json
{
  "nir_band": [[0.8, 0.85], [0.75, 0.9]],
  "red_band": [[0.1, 0.12], [0.08, 0.1]]
}
```
- **Response `200 OK`**:
```json
{
  "mean_ndvi": 0.7788,
  "min_ndvi": 0.7368,
  "max_ndvi": 0.8039,
  "vegetation_density_category": "DENSE_VEGETATION",
  "grid_shape": [2, 2]
}
```

- **Endpoint**: `POST /api/v1/geospatial/lst`
- **Request Body**:
```json
{
  "tir_brightness_temp_kelvin": [[315.0, 316.0], [314.5, 315.5]],
  "ndvi_matrix": [[0.1, 0.15], [0.12, 0.14]]
}
```
- **Response `200 OK`**:
```json
{
  "mean_lst_celsius": 42.45,
  "min_lst_celsius": 41.72,
  "max_lst_celsius": 43.18,
  "heat_stress_category": "SEVERE_HEAT_STRESS"
}
```

### 2.2. ML Heat Severity Prediction
- **Endpoint**: `POST /api/v1/predict/heat-severity`
- **Request Body**:
```json
{
  "region_id": "ward-01",
  "surface_temperature_celsius": 43.2,
  "ndvi": 0.14,
  "built_up_percentage": 81.5,
  "canopy_cover_percentage": 7.2,
  "albedo": 0.16,
  "population_density_per_km2": 20138.89
}
```
- **Response `200 OK`**:
```json
{
  "region_id": "ward-01",
  "predicted_heat_severity_score": 75.8,
  "predicted_severity_level": "CRITICAL",
  "confidence_interval": [72.3, 79.3],
  "model_version": "v1.0-uncalibrated",
  "model_status": "PHYSICAL_EMPIRICAL_BASELINE",
  "model_details": {
    "trained_model_loaded": false,
    "checkpoint_path": "./models/heat_severity_model.joblib"
  }
}
```

### 2.3. ML Cooling Impact Prediction
- **Endpoint**: `POST /api/v1/predict/cooling-impact`
- **Request Body**:
```json
{
  "region_id": "ward-01",
  "strategy_id": "cool-roofs",
  "coverage_percentage": 50.0,
  "baseline_temperature_celsius": 43.2,
  "baseline_ndvi": 0.14,
  "baseline_built_up_percentage": 81.5
}
```
- **Response `200 OK`**:
```json
{
  "region_id": "ward-01",
  "strategy_id": "cool-roofs",
  "coverage_percentage": 50.0,
  "predicted_temp_reduction_celsius": 1.41,
  "predicted_new_temperature_celsius": 41.79,
  "model_status": "CALIBRATED_MICROMETEOROLOGICAL_SIMULATION",
  "model_version": "v1.0-cooling-physics"
}
```

---

## Part 3: AI Service ↔ XAI Module (`xai/`)

### 3.1. SHAP Explanation API
- **Endpoint**: `POST /api/v1/explain/shap`
- **Request Body**:
```json
{
  "region_id": "ward-01",
  "feature_vector": {
    "surface_temperature_celsius": 43.2,
    "ndvi": 0.14,
    "built_up_percentage": 81.5,
    "canopy_cover_percentage": 7.2,
    "albedo": 0.16,
    "population_density_per_km2": 20138.89
  },
  "model_name": "heat_severity_regressor"
}
```

#### Case A: Model Uncalibrated / Weights Missing (Strict Data Integrity)
```json
{
  "region_id": "ward-01",
  "status": "MODEL_NOT_TRAINED",
  "explanation_ready": false,
  "base_value": null,
  "feature_contributions": null,
  "message": "Explainable AI requires a trained model artifact (.joblib / .pkl) and a background reference distribution to compute real Shapley values. No synthetic SHAP numbers are generated to protect data validity.",
  "metadata": {
    "required_features": [
      "surface_temperature_celsius",
      "ndvi",
      "built_up_percentage",
      "canopy_cover_percentage",
      "albedo",
      "population_density_per_km2"
    ],
    "explainer_class": "ShapExplainer"
  }
}
```

#### Case B: Model Trained & Calibrated
```json
{
  "region_id": "ward-01",
  "status": "COMPUTED",
  "explanation_ready": true,
  "base_value": 52.4,
  "feature_contributions": [
    {
      "feature_name": "surface_temperature_celsius",
      "feature_value": 43.2,
      "shap_value": 14.82,
      "impact_direction": "INCREASES_HEAT"
    },
    {
      "feature_name": "ndvi",
      "feature_value": 0.14,
      "shap_value": 8.11,
      "impact_direction": "INCREASES_HEAT"
    },
    {
      "feature_name": "built_up_percentage",
      "feature_value": 81.5,
      "shap_value": 6.34,
      "impact_direction": "INCREASES_HEAT"
    }
  ],
  "message": "SHAP feature attributions computed successfully using trained model."
}
```
