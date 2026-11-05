"""File-based storage of analysis-run artefacts (stacks, tables, models, plots).

Each run lives in data/processed/<run_id>/. The Spring Boot backend persists the
results in PostgreSQL/PostGIS; this store only keeps heavy artefacts (rasters, models).
"""
from __future__ import annotations

import json
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from app.config import PROCESSED_DIR
from app.utils.errors import NotFoundError, PipelineStateError

_RUN_ID_RE = re.compile(r"^[A-Za-z0-9_-]{4,64}$")
_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


class _NumpyEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.floating):
            return None if not np.isfinite(o) else float(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
        if isinstance(o, (np.bool_,)):
            return bool(o)
        return super().default(o)


def clean_json(obj: Any) -> Any:
    """Recursively replace NaN/inf with None so payloads are valid JSON."""
    if isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean_json(v) for v in obj]
    if isinstance(obj, (float, np.floating)):
        return float(obj) if np.isfinite(obj) else None
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return clean_json(obj.tolist())
    return obj


def new_run_id() -> str:
    return datetime.now(timezone.utc).strftime("run_%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:6]


def run_dir(run_id: str, must_exist: bool = True) -> Path:
    if not _RUN_ID_RE.match(run_id or ""):
        raise NotFoundError(f"Invalid run id '{run_id}'")
    path = PROCESSED_DIR / run_id
    if must_exist and not path.exists():
        raise NotFoundError(f"Analysis run '{run_id}' not found")
    path.mkdir(parents=True, exist_ok=True)
    return path


def run_lock(run_id: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(run_id, threading.Lock())


def write_json(run_id: str, name: str, payload: Any) -> Path:
    path = run_dir(run_id) / name
    path.write_text(json.dumps(clean_json(payload), cls=_NumpyEncoder, indent=1), encoding="utf-8")
    return path


def read_json(run_id: str, name: str, step_hint: str | None = None) -> Any:
    path = run_dir(run_id) / name
    if not path.exists():
        hint = f" Run '{step_hint}' first." if step_hint else ""
        raise PipelineStateError(f"'{name}' is not available for run {run_id}.{hint}")
    return json.loads(path.read_text(encoding="utf-8"))


def require_file(run_id: str, name: str, step_hint: str) -> Path:
    path = run_dir(run_id) / name
    if not path.exists():
        raise PipelineStateError(f"'{name}' is missing for run {run_id}. Run '{step_hint}' first.")
    return path


def list_runs() -> list[dict]:
    runs = []
    for p in sorted(PROCESSED_DIR.glob("run_*"), reverse=True):
        meta = p / "run.json"
        if meta.exists():
            try:
                runs.append(json.loads(meta.read_text(encoding="utf-8")))
            except json.JSONDecodeError:
                continue
    return runs


def latest_run_with(filename: str) -> str | None:
    for p in sorted(PROCESSED_DIR.glob("run_*"), key=lambda x: x.stat().st_mtime, reverse=True):
        if (p / filename).exists():
            return p.name
    return None
