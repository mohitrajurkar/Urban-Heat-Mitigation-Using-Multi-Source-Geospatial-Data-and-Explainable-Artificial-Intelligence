import logging
import sys

from app.config import LOG_LEVEL


def configure_logging() -> None:
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
        stream=sys.stdout,
        force=True,
    )
    for noisy in ("rasterio", "matplotlib", "numba", "shap", "pyogrio", "fiona"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
