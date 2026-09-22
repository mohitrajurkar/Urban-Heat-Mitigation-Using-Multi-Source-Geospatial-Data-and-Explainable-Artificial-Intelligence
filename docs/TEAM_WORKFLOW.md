# Team Workflow & Developer Guidelines: Heat-AI

This guide details how different engineers and data scientists can work simultaneously on Heat-AI without code conflicts, environment bottlenecks, or broken dependencies.

---

## 1. Team Roles & Module Ownership

| Role | Module Ownership | Tech Stack | Local Port |
|---|---|---|---|
| **Frontend Engineer** | `frontend/` | React 19, TypeScript, Vite, CSS | `5173` |
| **Backend & Database Engineer** | `backend/` | Java 21, Spring Boot, PostgreSQL/PostGIS | `8080` |
| **AI / Geospatial Data Scientist** | `ai/` | Python 3, FastAPI, NumPy, Scikit-Learn | `8000` |
| **Explainable AI (XAI) Engineer** | `xai/` | Python, SHAP, Cooperative Game Theory | Library / `8000` |

---

## 2. Independent Developer Workflows

### 2.1. Frontend Engineer Workflow
You do **not** need Java, Maven, Python, or PostgreSQL installed on your machine.

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:5173](http://localhost:5173).
4. **Mock Mode Guarantee**: If no backend is running on port 8080, the client automatically uses its in-browser calculation engine. A badge in the header shows `"In-Browser Fallback Engine"`. When the backend comes online, it switches seamlessly to `"Spring Boot API"`.
5. Run lint & build validation:
   ```bash
   npm run build
   ```

---

### 2.2. Backend & Database Engineer Workflow
You do **not** need Node.js or Python installed to develop and test backend APIs.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. **Development with In-Memory H2 (Default)**:
   ```bash
   # Windows:
   .\mvnw.cmd spring-boot:run
   # Linux / macOS:
   ./mvnw spring-boot:run
   ```
   - API endpoints: [http://localhost:8080/api/wards](http://localhost:8080/api/wards)
   - H2 Console: [http://localhost:8080/h2-console](http://localhost:8080/h2-console) (JDBC: `jdbc:h2:mem:urban_heat`)
3. **Production with PostgreSQL + PostGIS**:
   ```bash
   .\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=postgis
   ```
4. **AI Fallback Guarantee**: If the Python `ai/` service is offline, the backend automatically uses its internal deterministic engines. You will never see 500 errors caused by missing AI microservices.
5. Compile and test:
   ```bash
   .\mvnw.cmd test-compile
   ```

---

### 2.3. AI & Geospatial Data Scientist Workflow
You do **not** need Java or Node.js installed.

1. Navigate to the AI directory:
   ```bash
   cd ai
   python -m venv venv

   # Activate virtual environment:
   .\venv\Scripts\Activate.ps1    # Windows
   source venv/bin/activate       # Linux/macOS

   pip install -r requirements.txt
   ```
2. Start the FastAPI microservice:
   ```bash
   python run.py
   # Or via uvicorn:
   uvicorn app.main:app --reload --port 8000
   ```
3. Access interactive Swagger API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
4. Run automated test suite:
   ```bash
   python tests/run_tests.py
   ```

---

### 2.4. Explainable AI (XAI) Engineer Workflow
You can develop, validate, and benchmark SHAP explainers in isolation.

1. Navigate to the XAI directory:
   ```bash
   cd xai
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```
2. Run XAI test suite:
   ```bash
   python tests/test_xai.py
   ```
3. **Mounting a Trained Model**:
   - Train your model (e.g. `RandomForestRegressor`) on satellite features.
   - Save the model artifact to `ai/models/heat_severity_model.joblib`.
   - The AI service will automatically initialize `ShapExplainer(model=rf)` and serve real Shapley values on `/api/v1/explain/shap`.

---

## 3. Git & Branching Guidelines to Avoid Conflicts

1. **Feature Branch Naming**:
   - Frontend features: `feat/frontend-interactive-charts`
   - Backend features: `feat/backend-postgis-queries`
   - AI features: `feat/ai-sentinel-lst`
   - XAI features: `feat/xai-waterfall-plots`
2. **Strict Module Boundary Rule**:
   - Avoid editing files in another module's folder. If an API contract needs changing, update `docs/API_CONTRACT.md` first and communicate with the corresponding module owner.
3. **Zero Monolithic Dependencies**:
   - Never introduce imports that cross between Java and Python or Node. All communication must occur over HTTP REST APIs.

---

## 4. Running the Entire System (Full Stack)

To run the entire ecosystem locally:

```bash
# Terminal 1 (Python AI & XAI Microservice)
cd ai && python run.py

# Terminal 2 (Java Spring Boot Backend)
cd backend && .\mvnw.cmd spring-boot:run

# Terminal 3 (React Frontend)
cd frontend && npm run dev
```

Then visit [http://localhost:5173](http://localhost:5173). The dashboard will automatically connect to the Java backend and utilize live microservices!
