# Urban Heat AI Microservice (`ai/`)

## 1. Module Responsibility
The `ai/` module is an independent Python FastAPI microservice responsible for:
1. **Geospatial Preprocessing**: Spectral band calculations (NDVI, NDBI), Land Surface Temperature (LST) derivation from thermal infrared radiance (Sobrino et al. split-window / single-channel emissivity estimation).
2. **Machine Learning Heat Prediction**: Severity scoring and cooling effect simulation ($\Delta T$ estimation) for mitigation interventions (cool roofs, tree planting, green roofs, urban pocket parks).
3. **Integration with Explainable AI (`xai/`)**: Integrates with the dedicated `xai/` module to provide game-theoretic SHAP (SHapley Additive exPlanations) via the `/api/v1/explain/shap` endpoint.

> **Data Integrity Notice**:
> If no trained ML checkpoint (`.joblib` / `.pkl`) is mounted, the service returns explicit `MODEL_NOT_TRAINED` metadata with `explanation_ready: false`. It **strictly avoids generating fake or random SHAP numbers**.

---

## 2. Directory Structure

```text
ai-service/
├── app/
│   ├── geospatial/          # Remote sensing & spectral indices preprocessor
│   │   ├── __init__.py
│   │   └── preprocessor.py  # NDVI, NDBI, LST (Kelvin to Celsius) algorithms
│   ├── ml/                  # Machine Learning prediction & inference engines
│   │   ├── __init__.py
│   │   └── predictor.py     # HeatSeverityPredictor & CoolingImpactPredictor
│   ├── schemas/             # Pydantic request/response validation models
│   │   ├── __init__.py
│   │   ├── explainability.py
│   │   ├── geospatial.py
│   │   └── prediction.py
│   ├── config.py            # Environment configuration
│   └── main.py              # FastAPI application & route definitions
├── explainability/          # Dedicated Explainable AI module
│   ├── __init__.py
│   └── shap_explainer.py    # Real SHAP bindings & BaseExplainer interface
├── models/                  # Directory for trained ML model artifacts (.joblib/.pkl)
├── tests/                   # Automated unit & integration tests
├── requirements.txt         # Python package dependencies
├── run.py                   # Standalone service runner
└── README.md                # This documentation
```

---

## 3. How to Run Independently

### Prerequisites
- Python 3.10+ (tested with Python 3.11, 3.12, and 3.13)

### Step 1: Create Virtual Environment
```bash
cd ai-service
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Linux / macOS:
source venv/bin/activate
```

### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Start the Service
```bash
python run.py
```
Or directly via Uvicorn:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The service will start on `http://localhost:8000`.

### Step 4: Interactive API Documentation (Swagger)
Open your browser and navigate to:
- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

---

## 4. Running Tests

Run the test suite with pytest from the `ai-service/` directory:
```bash
pytest tests/ -v
```

---

## 5. REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Microservice health check & subsystem status |
| `GET` | `/api/v1/status` | Detailed capability information |
| `POST` | `/api/v1/geospatial/ndvi` | Computes NDVI matrix & summary from NIR and Red bands |
| `POST` | `/api/v1/geospatial/lst` | Computes LST in Celsius from thermal IR brightness temp |
| `POST` | `/api/v1/predict/heat-severity` | Predicts heat severity score (0-100) & risk level |
| `POST` | `/api/v1/predict/cooling-impact` | Predicts expected $\Delta T$ (°C) reduction for interventions |
| `POST` | `/api/v1/explain/shap` | Computes real SHAP feature attributions |
| `GET` | `/api/v1/explain/status` | Checks if SHAP explainer has trained model loaded |

---

## 6. How to Integrate a Trained ML Model
1. Train your model using scikit-learn or XGBoost (e.g. `RandomForestRegressor`).
2. Ensure the feature order matches:
   `["surface_temperature_celsius", "ndvi", "built_up_percentage", "canopy_cover_percentage", "albedo", "population_density_per_km2"]`
3. Save the model into `ai-service/models/heat_severity_model.joblib`.
4. Restart the service. The service will automatically detect the checkpoint, set `is_trained=True`, and enable live SHAP computations.
