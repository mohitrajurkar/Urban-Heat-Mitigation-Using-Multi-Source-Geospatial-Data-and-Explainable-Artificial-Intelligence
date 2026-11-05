"""Runtime configuration for the AI service (environment variables override defaults)."""
from __future__ import annotations

import os
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("UHM_DATA_DIR", SERVICE_DIR.parent / "data")).resolve()
SAMPLE_DIR = DATA_DIR / "sample"
UPLOAD_DIR = DATA_DIR / "uploads"
PROCESSED_DIR = DATA_DIR / "processed"

MAX_UPLOAD_MB = int(os.getenv("UHM_MAX_UPLOAD_MB", "300"))
LOG_LEVEL = os.getenv("UHM_LOG_LEVEL", "INFO")
RANDOM_SEED = int(os.getenv("UHM_RANDOM_SEED", "42"))
AUTO_GENERATE_DEMO = os.getenv("UHM_AUTO_GENERATE_DEMO", "true").lower() == "true"
SERVICE_VERSION = "1.0.0"

for _d in (SAMPLE_DIR, UPLOAD_DIR, PROCESSED_DIR):
    _d.mkdir(parents=True, exist_ok=True)
