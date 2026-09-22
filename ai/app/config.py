import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Urban Heat AI & Geospatial Service"
    version: str = "1.0.0"
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    environment: str = os.getenv("ENVIRONMENT", "development")
    model_dir: str = os.getenv("MODEL_DIR", "./models")
    enable_geo_mock_fallback: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
