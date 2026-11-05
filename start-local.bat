@echo off
REM ============================================================================
REM  Urban Heat Mitigation DSS - local start (no app containers)
REM  PostGIS runs in Docker; AI service, backend and frontend run natively.
REM  Ports: frontend 5174 | backend 8080 | AI service 8001 | PostGIS 5434
REM ============================================================================
setlocal
cd /d "%~dp0"

echo [1/4] Starting PostgreSQL + PostGIS (Docker, port 5434)...
docker compose up -d db
if errorlevel 1 (
  echo ERROR: Could not start the database. Is Docker Desktop running?
  pause
  exit /b 1
)

echo [2/4] Starting Python AI service on http://localhost:8001 ...
if not exist "ai-service\.venv\Scripts\python.exe" (
  echo    Creating Python virtual environment and installing requirements - first run only...
  py -3.12 -m venv ai-service\.venv
  ai-service\.venv\Scripts\python.exe -m pip install -r ai-service\requirements.txt
)
start "UHM AI service :8001" cmd /k "cd /d %~dp0ai-service && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001"

echo [3/4] Starting Spring Boot backend on http://localhost:8080 ...
start "UHM backend :8080" cmd /k "cd /d %~dp0backend && mvn -q spring-boot:run"

echo [4/4] Starting React frontend on http://localhost:5174 ...
if not exist "frontend\node_modules" (
  pushd frontend
  call npm install
  popd
)
start "UHM frontend :5174" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo  Waiting for the backend (first start takes ~30 s; the demo analysis then runs ~1 min)...
timeout /t 25 /nobreak >nul
start "" http://localhost:5174
echo.
echo  Frontend      http://localhost:5174   (login: admin / Admin@123)
echo  Backend API   http://localhost:8080/swagger-ui/index.html
echo  AI service    http://localhost:8001/docs
echo  Close the three service windows to stop the application.
endlocal
