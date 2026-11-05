"""Test configuration: isolate all data writes in a temporary directory.

UHM_DATA_DIR must be set before any `app.*` import, because app.config reads it at import time.
"""
import os
import shutil
import tempfile
from pathlib import Path

import pytest

_REPO_SAMPLE = Path(__file__).resolve().parents[2] / "data" / "sample"
_TMP = Path(tempfile.mkdtemp(prefix="uhm_test_"))
if (_REPO_SAMPLE / "catalog.json").exists():
    shutil.copytree(_REPO_SAMPLE, _TMP / "sample")
os.environ["UHM_DATA_DIR"] = str(_TMP)


@pytest.fixture(scope="session")
def data_dir() -> Path:
    return _TMP


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:  # runs lifespan -> generates demo data if missing
        yield c


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_TMP, ignore_errors=True)
