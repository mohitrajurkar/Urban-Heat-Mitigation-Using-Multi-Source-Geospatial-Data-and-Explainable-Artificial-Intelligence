# Java Spring Boot Backend Service (`backend/`)

## 1. Module Responsibility
The `server-java` module is the primary backend application server responsible for:
1. **REST API Gateway**: Exposing municipal decision support endpoints (`/api/wards`, `/api/strategies`, `/api/grid-cells`, `/api/scenario/analyze`).
2. **Database & Persistence Layer**: JPA/Hibernate entities (`HeatArea`, `Intervention`) supporting both lightweight development (H2 in-memory) and production spatial storage (PostgreSQL + PostGIS).
3. **Domain Business Logic**: Multi-criteria priority scoring, vulnerability assessment, and scenario mitigation simulation.
4. **AI Microservice Client (`AiServiceClient`)**: Communicating via REST with `ai-service` (port 8000) for ML predictions and SHAP explainability, with non-blocking fallback to internal deterministic logic when the AI service is offline.

---

## 2. Directory Structure

```text
server-java/
├── src/
│   ├── main/
│   │   ├── java/com/mohit/urbanheatai/
│   │   │   ├── business/       # Heuristic engines (Scoring, Vulnerability, Priority, Scenario)
│   │   │   ├── client/         # AiServiceClient (REST communication with Python ai-service)
│   │   │   ├── config/         # App properties & beans
│   │   │   ├── controller/     # WardDecisionController, HeatController, InterventionController
│   │   │   ├── dto/            # Data transfer objects
│   │   │   ├── entity/         # JPA entities (HeatArea, Intervention)
│   │   │   ├── repository/     # Spring Data JPA repositories
│   │   │   └── service/        # WardDecisionService, HeatService, InterventionService
│   │   └── resources/
│   │       ├── application.properties         # Default profile (H2 in-memory DB, port 8080)
│   │       └── application-postgis.properties # PostGIS production profile (PostgreSQL)
│   └── test/                   # Spring Boot tests
├── pom.xml                     # Maven project configuration
├── mvnw / mvnw.cmd             # Maven wrapper scripts
└── README.md                   # This documentation
```

---

## 3. How to Run Independently

### Prerequisites
- JDK 17 or higher (tested with Java 17 and Java 21)

### Mode A: Default Development Mode (H2 In-Memory DB)
Runs entirely standalone without requiring an external database:
```bash
cd server-java

# On Windows:
.\mvnw.cmd spring-boot:run

# On Linux / macOS:
./mvnw spring-boot:run
```

- Server port: `http://localhost:8080`
- Health check: `http://localhost:8080/api/health`
- H2 Console: `http://localhost:8080/h2-console` (JDBC URL: `jdbc:h2:mem:urban_heat`, User: `sa`, Password: *blank*)

### Mode B: PostgreSQL + PostGIS Mode
To run with a live PostgreSQL/PostGIS spatial database:
1. Ensure PostgreSQL with PostGIS extension is installed and running:
   ```sql
   CREATE DATABASE heat_ai_db;
   \c heat_ai_db
   CREATE EXTENSION postgis;
   ```
2. Start Spring Boot with the `postgis` profile:
   ```bash
   .\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=postgis
   ```
   Or run the packaged JAR:
   ```bash
   java -jar target/urban-heat-ai-0.0.1-SNAPSHOT.jar --spring.profiles.active=postgis
   ```

---

## 4. REST API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Service health and AI microservice connection status |
| `GET` | `/api/ai-status` | Connectivity and health report for Python `ai-service` |
| `GET` | `/api/wards` | List of wards with baseline heat and vulnerability metrics |
| `GET` | `/api/wards/{id}` | Detailed profile of a single ward |
| `GET` | `/api/wards/{id}/analysis` | Decision analysis with priority scores and explanations |
| `GET` | `/api/wards/{id}/recommendations` | Ranked mitigation strategy recommendations |
| `GET` | `/api/strategies` | Catalog of urban cooling mitigation interventions |
| `GET` | `/api/grid-cells` | 1 km x 1 km spatial grid cells for urban heat mapping |
| `POST` | `/api/scenario/analyze` | Simulates temperature reduction for intervention coverage |
| `GET` | `/heat` | CRUD endpoint for heat observation areas |
| `GET` | `/interventions` | CRUD endpoint for planned ward interventions |

---

## 5. Working Without the AI Service
If the Python `ai-service` is not running, `server-java` automatically detects this and falls back to internal deterministic scoring and recommendations. You do **not** need the Python service running to test or develop backend API features.
