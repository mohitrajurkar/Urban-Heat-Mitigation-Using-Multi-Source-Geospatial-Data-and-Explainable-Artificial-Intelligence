"""FastAPI application entry point for the Urban Heat Mitigation AI/ML service."""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.api.routes import router
from app.utils.errors import ServiceError
from app.utils.logging_config import configure_logging

configure_logging()
log = logging.getLogger("uhm.ai")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if config.AUTO_GENERATE_DEMO and not (config.SAMPLE_DIR / "catalog.json").exists():
        from app.geospatial.demo_data import generate_demo_datasets

        generate_demo_datasets()
    log.info("AI service ready. Data dir: %s", config.DATA_DIR)
    yield


app = FastAPI(
    title="Urban Heat Mitigation - AI/ML Service",
    description="Geospatial preprocessing, environmental indicators (LST, NDVI, NDBI, NDWI, albedo), Random Forest & XGBoost "
                "models, SHAP explainability, hotspot detection and mitigation recommendations. Called by the Spring Boot backend.",
    version=config.SERVICE_VERSION,
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://localhost:8080"], allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def access_log(request: Request, call_next):
    t0 = time.time()
    response = await call_next(request)
    if request.url.path != "/health":
        log.info("%s %s -> %s (%.0f ms)", request.method, request.url.path, response.status_code, 1000 * (time.time() - t0))
    return response


@app.exception_handler(ServiceError)
async def service_error_handler(_: Request, exc: ServiceError):
    return JSONResponse(status_code=exc.status_code, content={"error": type(exc).__name__, "message": exc.message})


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errors = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"error": "ValidationError", "message": "Request validation failed", "details": errors})


@app.exception_handler(Exception)
async def unhandled_handler(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"error": "InternalError", "message": f"{type(exc).__name__}: {exc}"})


app.include_router(router)
