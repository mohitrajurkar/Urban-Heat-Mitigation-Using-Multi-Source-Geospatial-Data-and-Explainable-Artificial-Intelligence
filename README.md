# Urban Heat Mitigation Using Multi-Source Geospatial Data and Explainable AI

Final Year B.Tech CSE project — a decision support system that detects Urban Heat Island hotspots in **Nagpur**,
explains their drivers with **SHAP**, and recommends, costs and prioritises mitigation strategies.

> **Demonstration data:** the bundled datasets in `data/sample/` are **synthetic** replicas of Landsat 9, Sentinel-2,
> LULC, population, meteorological and road data (every file's metadata says `is_demo: true, is_real: false`).
> Upload real data in *Datasets & Analysis* to analyse actual conditions.

## Architecture

```
React + TS + Leaflet (5174) --/api--> Spring Boot + JWT (8080) --REST--> FastAPI AI/ML (8001)
                                              |                              (Rasterio, GeoPandas,
                                              v                               scikit-learn, XGBoost, SHAP)
                                   PostgreSQL 16 + PostGIS 3.4 (5434)
```

Pipeline: preprocessing (CRS conversion to UTM 44N, resampling to 100 m, calibration, invalid-pixel / outlier / missing-value
handling, Sentinel-2 fusion) → indicators (LST, NDVI, NDBI, NDWI, albedo, LULC) → Random Forest & XGBoost
(classification + LST regression, spatial block hold-out, no LST in inputs) → SHAP → hotspots (μ/σ thresholds + Getis-Ord Gi*)
→ recommendations (5 strategies, cost + cooling) → priority ranking → PostGIS → dashboard + PDF report.

## Run locally (Windows 11)

Prerequisites: Docker Desktop (for PostGIS only), Python 3.12, Java 17+, Maven 3.9, Node 20+.

```bat
start-local.bat
```

Then open **http://localhost:5174** and sign in.

| Account | Password | Role |
|---|---|---|
| admin | Admin@123 | Administrator |
| analyst | Analyst@123 | Run analyses, upload data, reports |
| viewer | Viewer@123 | Read-only (project guide) |

On first launch the backend automatically runs the Nagpur demonstration analysis (~1 minute); progress appears in the sidebar.
*Datasets & Analysis → Reset demo data* re-runs it from scratch.

| Service | URL |
|---|---|
| Frontend | http://localhost:5174 |
| Backend Swagger | http://localhost:8080/swagger-ui/index.html |
| AI service docs | http://localhost:8001/docs |
| PostGIS | localhost:5434 (db `urban_heat`, user `urbanheat`) |

Ports differ from the usual 5173 / 8000 / 5432 because other applications on the development machine already use those.

### Manual start (three terminals)

```bat
docker compose up -d db
cd ai-service && .venv\Scripts\python.exe -m uvicorn app.main:app --port 8001
cd backend && mvn spring-boot:run
cd frontend && npm install && npm run dev
```

## Tests

```bat
cd ai-service && .venv\Scripts\python.exe -m pytest
cd backend && mvn test
python scripts\smoke_test.py
```

`scripts/smoke_test.py` exercises every major REST endpoint of the running stack (auth, RBAC, GeoJSON, ML metrics,
SHAP, recommendations, budget planner, priority recalculation, PDF report).

## Project structure

```
ai-service/   FastAPI service: app/{api,preprocessing,features,geospatial,models,explainability,recommendations,utils}, tests/
backend/      Spring Boot: controller, service, repository, entity, dto, security, config; src/test
frontend/     React + Vite + Tailwind: pages, layouts, components, maps, charts, hooks, services, types
database/     init.sql + Flyway migrations (applied automatically by the backend)
data/sample/  synthetic Nagpur demonstration datasets + catalog.json
scripts/      smoke_test.py
```

Cost and cooling figures are approximate planning estimates (±25 %) defined in
`ai-service/app/recommendations/strategies.json`.
