# System Architecture Document: Heat-AI

## 1. Architectural Overview

Heat-AI is a multi-tier, decoupled decision support system engineered for urban heat resilience, microclimate mitigation planning, and geospatial analysis. The system is designed around **four independent modules**:

```text
┌────────────────────────────────────────────────────────┐
│                       frontend/                        │
│            React 19 + TypeScript + Vite UI             │
│            Interactive GIS Leaflet Dashboard           │
│                      (Port 5173)                       │
└───────────────────────────┬────────────────────────────┘
                            │
               REST APIs (HTTP / JSON)
                            ▼
┌────────────────────────────────────────────────────────┐
│                       backend/                         │
│           Java 21 Spring Boot Application              │
│       REST Gateway + PostgreSQL / PostGIS DB           │
│                      (Port 8080)                       │
└───────────────────────────┬────────────────────────────┘
                            │
               REST APIs (HTTP / JSON)
                            ▼
┌────────────────────────────────────────────────────────┐
│                          ai/                           │
│              Python FastAPI Microservice               │
│       Geospatial Preprocessing & ML Predictions        │
│                      (Port 8000)                       │
└───────────────────────────┬────────────────────────────┘
                            │
              Direct Import / REST Call
                            ▼
┌────────────────────────────────────────────────────────┐
│                          xai/                          │
│               Explainable AI / SHAP Engine             │
│            True Game-Theoretic Interpretability        │
└────────────────────────────────────────────────────────┘
```

---

## 2. Module Boundaries & Responsibilities

### 2.1. `frontend/` (React + TypeScript UI)
- **Primary Stack**: React 19, TypeScript, Vite, Leaflet, Lucide React.
- **Responsibilities**:
  - Render interactive GIS map layers with smooth thermal heatmap gradient generation.
  - Multi-ward comparative decision table and vulnerability ranking.
  - What-If Scenario Analysis Simulator (sliders for intervention coverage %, dynamic cooling impact calculations).
  - Mitigation strategy catalog and municipal executive reports.
- **Independence & Decoupling**:
  - Can run 100% offline using a built-in TypeScript fallback engine.
  - Automatically queries `http://localhost:8080/api` when available.

### 2.2. `backend/` (Java Spring Boot REST Gateway & PostGIS)
- **Primary Stack**: Java 21, Spring Boot 4/3, Spring Data JPA, PostgreSQL + PostGIS, H2 (dev mode).
- **Responsibilities**:
  - Central REST API gateway for all client-facing data requests.
  - Geospatial database persistence for administrative ward boundaries, grid cells, and interventions.
  - Domain business logic: multi-criteria priority scoring, vulnerability assessment, and scenario mitigation simulation.
  - Integration with `ai/` through [`AiServiceClient`](file:///d:/Project/Heat-ai/backend/src/main/java/com/mohit/urbanheatai/client/AiServiceClient.java).
- **Fault Tolerance**:
  - Employs a non-blocking timeout (1500 ms) and circuit-breaker pattern. If `ai/` is offline or uncalibrated, the backend safely falls back to internal deterministic scoring without interrupting client operations.

### 2.3. `ai/` (Python Geospatial Preprocessing & ML Prediction)
- **Primary Stack**: Python 3.10+, FastAPI, Uvicorn, NumPy, Scikit-Learn, Pydantic.
- **Responsibilities**:
  - **Geospatial Preprocessing**: Remote sensing band arithmetic:
    - $\text{NDVI} = \frac{\text{NIR} - \text{Red}}{\text{NIR} + \text{Red}}$
    - $\text{NDBI} = \frac{\text{SWIR} - \text{NIR}}{\text{SWIR} + \text{NIR}}$
    - Land Surface Temperature (LST) derivation from thermal infrared radiance (Sobrino split-window method with fractional vegetation emissivity correction).
  - **ML Prediction**: Machine learning regression models predicting urban heat severity scores (0-100) and micrometerological cooling effect ($\Delta T$ in °C) for selected intervention types.
- **Independence**: Exposes an independent REST service on port 8000 with interactive Swagger UI at `/docs`.

### 2.4. `xai/` (Explainable AI / SHAP Engine)
- **Primary Stack**: Python, SHAP (`TreeExplainer`, `KernelExplainer`), NumPy, Scikit-Learn, Pydantic.
- **Responsibilities**:
  - Computes exact cooperative game theory Shapley values ($\phi_i$) indicating the marginal contribution of each urban feature to heat severity.
  - Provides model transparency: why an intervention was recommended, and what environmental conditions drove high priority classifications.
- **Strict Data Integrity Contract**:
  - When no trained ML model checkpoint (`.joblib` / `.pkl`) is mounted, the module strictly returns `status: "MODEL_NOT_TRAINED"` and `feature_contributions: null`.
  - **Zero fake or pseudo-random SHAP numbers are generated.**

---

## 3. Data Flow Architecture

### Scenario 1: Ward Analysis & Decision Support Flow
```text
1. User clicks Ward on Map
      │
      ▼
2. frontend/ queries GET /api/wards/{id}/analysis
      │
      ▼
3. backend/ retrieves baseline ward geometry & socio-economic metrics from PostGIS/H2
      │
      ├──> [Optional] backend/ calls ai/ POST /api/v1/predict/heat-severity
      │         │
      │         └──> ai/ queries xai/ POST /api/v1/explain/shap
      │                   └──> xai/ calculates Shapley values on trained model
      │
      └──> (Fallback) backend/ uses internal ScoringEngine & ExplanationEngine
      │
      ▼
4. backend/ returns consolidated DecisionResultDTO to frontend/
      │
      ▼
5. frontend/ renders Heat Severity score, radar charts, and ranked interventions
```

---

## 4. Technology Decisions Rationale

| Requirement | Choice | Rationale |
|---|---|---|
| **High-Performance Spatial Storage** | PostgreSQL + PostGIS | Industry-standard for storing GeoJSON polygons, spatial indexing (R-Tree / GIST), and ST_Contains queries. |
| **Enterprise API Robustness** | Java 21 + Spring Boot | Strong typing, declarative validation, seamless JPA connection pooling, and multi-threaded request handling. |
| **Scientific & Remote Sensing Math** | Python 3 + FastAPI | Unmatched ecosystem for raster array manipulation (NumPy) and machine learning (Scikit-Learn/SHAP). |
| **Rapid, Responsive UI** | React 19 + TypeScript + Vite | Ultra-fast HMR build times, rich interactive mapping ecosystem (Leaflet), and clean component hierarchy. |
| **Microservice Decoupling** | HTTP REST + JSON | Allows each team member to use different operating systems, IDEs, and runtimes without merge conflicts. |
