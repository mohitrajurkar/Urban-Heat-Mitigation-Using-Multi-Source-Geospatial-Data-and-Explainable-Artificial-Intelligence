"""REST endpoints of the AI/ML service. Heavy endpoints are sync `def` so FastAPI runs them in a worker thread pool."""
from __future__ import annotations

import logging
import platform
import shutil
import tempfile
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, Query, UploadFile
from fastapi.responses import FileResponse

from app import config
from app.api.schemas import PipelineRequest, PredictRequest, PreprocessRequest, RecommendationRequest, RunRequest, TrainRequest
from app.explainability.shap_explainer import explain_custom, explain_run
from app.features.extract import extract_features
from app.geospatial import hotspots
from app.models import prediction, training
from app.preprocessing.pipeline import preprocess
from app.recommendations import engine
from app.utils import datasets, run_store
from app.utils.errors import NotFoundError, ServiceError

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health", tags=["system"])
def health():
    return {"status": "UP", "service": "urban-heat-ai-service", "version": config.SERVICE_VERSION, "python": platform.python_version(),
            "demo_datasets_available": (config.SAMPLE_DIR / "catalog.json").exists(), "runs": len(run_store.list_runs())}


# ---------------------------------------------------------------- datasets
@router.get("/datasets", tags=["data"])
def list_datasets(data_type: Optional[str] = None):
    return [{k: v for k, v in d.items() if k != "path"} for d in datasets.list_datasets(data_type)]


@router.get("/datasets/{dataset_id}", tags=["data"])
def get_dataset(dataset_id: str):
    d = datasets.get_dataset(dataset_id)
    return {k: v for k, v in d.items() if k != "path"}


@router.delete("/datasets/{dataset_id}", tags=["data"])
def delete_dataset(dataset_id: str):
    datasets.delete_dataset(dataset_id)
    return {"deleted": dataset_id}


@router.post("/data/upload", tags=["data"], summary="Upload a GeoTIFF / CSV / GeoJSON dataset with metadata")
def upload(
    file: UploadFile = File(...),
    data_type: str = Form(..., description="landsat | sentinel2 | lulc | population | meteorological | roads | boundary"),
    name: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    collection_date: Optional[str] = Form(None),
    coverage: Optional[str] = Form(None),
    is_demo: bool = Form(False),
    is_real: bool = Form(True),
    landsat_params: Optional[str] = Form(None, description="JSON with MTL values (SUN_ELEVATION, REFLECTANCE_MULT, ..., PRODUCT_LEVEL)"),
    lulc_mapping: Optional[str] = Form(None, description="'esa_worldcover' or JSON {source_code: target_class}"),
):
    import json

    meta = {"data_type": data_type, "name": name, "source": source, "collection_date": collection_date, "coverage": coverage, "is_demo": is_demo, "is_real": is_real}
    try:
        if landsat_params:
            meta["landsat_params"] = json.loads(landsat_params)
        if lulc_mapping:
            meta["lulc_mapping"] = lulc_mapping if lulc_mapping == "esa_worldcover" else json.loads(lulc_mapping)
    except json.JSONDecodeError as exc:
        raise ServiceError(f"Invalid JSON in metadata field: {exc}") from exc
    tmp = Path(tempfile.mkdtemp(prefix="uhm_up_")) / "upload.bin"
    size = 0
    with tmp.open("wb") as fh:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > config.MAX_UPLOAD_MB * 1024 * 1024:
                shutil.rmtree(tmp.parent, ignore_errors=True)
                raise ServiceError(f"File exceeds {config.MAX_UPLOAD_MB} MB limit", 413)
            fh.write(chunk)
    try:
        record = datasets.register_upload(tmp, file.filename or "upload", meta)
    finally:
        shutil.rmtree(tmp.parent, ignore_errors=True)
    return {k: v for k, v in record.items() if k != "path"}


# ---------------------------------------------------------------- pipeline steps
@router.post("/data/preprocess", tags=["pipeline"])
def data_preprocess(req: PreprocessRequest):
    sel = req.datasets.model_dump() if req.datasets else datasets.default_demo_selection()
    return preprocess(req.study_area, sel, req.run_id, {"resolution_m": req.resolution_m, "cell_size_m": req.cell_size_m})


@router.post("/features/extract", tags=["pipeline"])
def features_extract(req: RunRequest):
    return extract_features(req.run_id)


@router.post("/model/train", tags=["models"])
def model_train(req: TrainRequest):
    return training.train(req.run_id, req.params.model_dump())


@router.post("/model/predict", tags=["models"])
def model_predict(req: PredictRequest):
    if req.features:
        res = prediction.predict_custom([f.model_dump() for f in req.features], req.run_id)
        res.pop("X", None)
        return res
    if not req.run_id:
        raise ServiceError("Provide run_id (predict all regions) or features (custom prediction)", 422)
    return prediction.predict_run(req.run_id)


@router.get("/model/evaluation", tags=["models"])
def model_evaluation(run_id: Optional[str] = Query(None)):
    rid = run_id or run_store.latest_run_with("evaluation.json")
    if not rid:
        raise NotFoundError("No model evaluation available yet. Train models first.")
    return run_store.read_json(rid, "evaluation.json", "/model/train")


@router.post("/explain/shap", tags=["explainability"])
def explain_shap(req: PredictRequest):
    if req.features:
        return {"results": explain_custom([f.model_dump() for f in req.features], req.run_id)}
    if not req.run_id:
        raise ServiceError("Provide run_id or features", 422)
    return explain_run(req.run_id)


@router.get("/explain/plot/{run_id}/{filename}", tags=["explainability"], response_class=FileResponse)
def explain_plot(run_id: str, filename: str):
    if not filename.endswith(".png") or "/" in filename or ".." in filename:
        raise ServiceError("Invalid plot name")
    path = run_store.run_dir(run_id) / "plots" / filename
    if not path.exists():
        raise NotFoundError("Plot not found; run /explain/shap first")
    return FileResponse(path, media_type="image/png")


@router.post("/hotspots/detect", tags=["hotspots"])
def hotspots_detect(req: RunRequest):
    return hotspots.detect(req.run_id)


@router.post("/recommendations/generate", tags=["recommendations"])
def recommendations_generate(req: RecommendationRequest):
    return engine.generate(req.run_id, req.overrides)


@router.get("/recommendations/config", tags=["recommendations"])
def recommendations_config():
    return engine.load_config()


# ---------------------------------------------------------------- layers & runs
@router.get("/layers/{run_id}", tags=["layers"])
def layers_meta(run_id: str):
    return run_store.read_json(run_id, "layers.json", "/features/extract")


@router.get("/layers/{run_id}/{layer}.png", tags=["layers"], response_class=FileResponse)
def layer_png(run_id: str, layer: str):
    if layer not in ("lst", "ndvi", "ndbi", "ndwi", "albedo", "lulc"):
        raise NotFoundError(f"Unknown layer '{layer}'")
    path = run_store.run_dir(run_id) / "layers" / f"{layer}.png"
    if not path.exists():
        raise NotFoundError("Layer not rendered; run /features/extract first")
    return FileResponse(path, media_type="image/png")


@router.get("/runs", tags=["system"])
def runs():
    return run_store.list_runs()


@router.post("/pipeline/run", tags=["pipeline"], summary="Run every step end-to-end (convenience endpoint)")
def pipeline_run(req: PipelineRequest):
    t0 = time.time()
    sel = req.datasets.model_dump() if req.datasets else datasets.default_demo_selection()
    pre = preprocess(req.study_area, sel, req.run_id, {"resolution_m": req.resolution_m, "cell_size_m": req.cell_size_m})
    rid = pre["run_id"]
    extract_features(rid)
    ev = training.train(rid, req.params.model_dump())
    prediction.predict_run(rid)
    explain_run(rid)
    hs = hotspots.detect(rid)
    rec = engine.generate(rid, req.overrides)
    return {"run_id": rid, "elapsed_seconds": round(time.time() - t0, 1), "best_model": ev["best_model"],
            "n_hotspots": hs["summary"]["n_hotspots"], "n_recommendations": rec["summary"]["n_recommendations"]}
