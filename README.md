# Heat-AI: Urban Heat Mitigation Decision Support System

An enterprise-grade, multi-modular decision support platform for urban microclimate resilience and Urban Heat Island (UHI) mitigation. The system ingests satellite earth observation indicators, computes heat severity and social vulnerability, evaluates cooling interventions, and produces model explanations.

---

## 1. Modular System Architecture

The codebase is organized into **four independent modules**:

```text
Heat-AI/
├── frontend/                   # React 19 + TypeScript UI & GIS Dashboard (Port 5173)
├── backend/                    # Java 21 Spring Boot REST Gateway & PostGIS (Port 8080)
├── ai/                         # Python FastAPI service: remote sensing & ML prediction (Port 8000)
├── xai/                        # Explainable AI (XAI) using SHAP (Shapley Additive exPlanations)
├── docs/                       # System documentation & specifications
│   ├── ARCHITECTURE.md         # Detailed system design & data flow
│   ├── API_CONTRACT.md         # REST API contracts, schemas & status codes
│   └── TEAM_WORKFLOW.md        # Independent developer guides & Git practices
├── server/                     # (Preserved) Prototype Node.js Express backend
├── package.json                # Root orchestration & test scripts
└── README.md                   # Project overview
```

---

## 2. Module Responsibilities & Tech Stack

| Module | Primary Stack | Responsibility | Port |
|---|---|---|---|
| **`frontend/`** | React 19, TypeScript, Vite, Leaflet | Interactive UI, GIS heatmaps, multi-ward ranking table, what-if scenario simulators, strategy comparisons. | `5173` |
| **`backend/`** | Java 21, Spring Boot 4/3, JPA, PostGIS | Central REST API gateway, database persistence, domain business logic, spatial grid aggregation, client delegation. | `8080` |
| **`ai/`** | Python 3.10+, FastAPI, NumPy, Scikit-Learn | Remote sensing band math (NDVI, NDBI, LST), ML heat severity regression, mitigation cooling simulation ($\Delta T$). | `8000` |
| **`xai/`** | Python, SHAP (`TreeExplainer`, `KernelExplainer`) | Game-theoretic feature attribution and model transparency. Computes real SHAP values on trained models. | Library / `8000` |

---

## 3. Inter-Module Communication

All modules are completely separated and communicate exclusively over HTTP REST APIs using JSON payloads:

```text
┌────────────────────────────────────────────────────────┐
│                       frontend/                        │
│            React + TypeScript Dashboard (5173)         │
└───────────────────────────┬────────────────────────────┘
                            │
               REST APIs (HTTP / JSON)
                            ▼
┌────────────────────────────────────────────────────────┐
│                        backend/                        │
│            Spring Boot REST Gateway (8080)             │
│          PostgreSQL / PostGIS Spatial Database         │
└───────────────────────────┬────────────────────────────┘
                            │
               REST APIs (HTTP / JSON)
                            ▼
┌────────────────────────────────────────────────────────┐
│                          ai/                           │
│              Python FastAPI Server (8000)              │
│       Geospatial Preprocessing & ML Predictions        │
└───────────────────────────┬────────────────────────────┘
                            │
               Direct Import / Call
                            ▼
┌────────────────────────────────────────────────────────┐
│                          xai/                          │
│               Explainable AI / SHAP Engine             │
└────────────────────────────────────────────────────────┘
```

- **Frontend to Backend**: `frontend/` queries `backend/` at `http://localhost:8080/api`. If `backend/` is not running, `frontend/` provides a built-in mock fallback for offline UI development.
- **Backend to AI Service**: `backend/` uses `AiServiceClient` to communicate with `ai/` at `http://localhost:8000`. If `ai/` is offline, `backend/` falls back gracefully to internal deterministic scoring without throwing errors.
- **Explainable AI Integration**: `POST http://localhost:8000/api/v1/explain/shap` computes real Shapley values via `xai/` when a trained model is loaded. When uncalibrated, it returns explicit `MODEL_NOT_TRAINED` metadata without fabricating fake SHAP numbers.

---

## 4. How Team Members Can Run Modules Independently

### A. Frontend Developer (`frontend/`)
You can develop and style the UI without running the Java backend or Python service!
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173). The dashboard automatically uses the in-browser fallback engine if backends are not detected.

---

### B. Backend & Database Developer (`backend/`)
You can run and test the Spring Boot server independently without needing the Python AI service.

**Option 1: In-Memory H2 Mode (Zero setup required)**
```bash
cd backend
.\mvnw.cmd spring-boot:run     # On Windows
./mvnw spring-boot:run         # On Linux / macOS
```
- API Base: [http://localhost:8080/api/wards](http://localhost:8080/api/wards)
- Health: [http://localhost:8080/api/health](http://localhost:8080/api/health)
- H2 Console: [http://localhost:8080/h2-console](http://localhost:8080/h2-console)

**Option 2: PostgreSQL + PostGIS Mode**
```bash
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=postgis
```

---

### C. AI & Geospatial Data Scientist (`ai/`)
```bash
cd ai
python -m venv venv
.\venv\Scripts\Activate.ps1    # On Windows (or source venv/bin/activate on Linux/macOS)
pip install -r requirements.txt
python run.py
```
- Interactive API Docs (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)
- Microservice Health: [http://localhost:8000/health](http://localhost:8000/health)
- Test Suite: `python tests/run_tests.py`

---

### D. Explainable AI (XAI) Engineer (`xai/`)
```bash
cd xai
python -m venv venv
.\venv\Scripts\Activate.ps1    # On Windows (or source venv/bin/activate on Linux/macOS)
pip install -r requirements.txt
python tests/test_xai.py
```

---

## 5. Explainable AI & Data Integrity Policy

In compliance with scientific integrity standards:
1. `xai/` provides real mathematical interfaces for `shap.TreeExplainer` and `shap.KernelExplainer`.
2. When no trained model checkpoint (`.joblib` / `.pkl`) is mounted into `ai/models/`, the API returns:
   ```json
   {
     "status": "MODEL_NOT_TRAINED",
     "explanation_ready": false,
     "base_value": null,
     "feature_contributions": null,
     "message": "Explainable AI requires a trained model artifact and background reference dataset..."
   }
   ```
3. **No fake or pseudo-random SHAP numbers are ever generated.**

---

## 6. Comprehensive Documentation in `docs/`

- **[System Architecture](docs/ARCHITECTURE.md)**: Deep dive into 4-tier design, decoupled boundaries, and technology stack.
- **[API Contract Specification](docs/API_CONTRACT.md)**: Full REST specifications, status codes, schemas, and payload examples.
- **[Team Workflow Guide](docs/TEAM_WORKFLOW.md)**: Developer isolation practices, Git branching strategies, and full-stack orchestration.

---

## 7. Convenience Root Commands

From the repository root:
- `npm run dev:frontend`: Start React frontend dev server
- `npm run dev:backend`: Start Java Spring Boot server
- `npm run dev:ai`: Start Python AI & XAI microservice
- `npm run test:ai`: Execute Python AI test suite
- `npm run test:xai`: Execute XAI unit tests
- `npm run build:frontend`: Build frontend production bundle
