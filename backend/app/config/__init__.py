from pydantic_settings import BaseSettings
from datetime import datetime, timezone


class Settings(BaseSettings):
    app_name: str = "ask-your-docai"
    environment: str = "development"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/ask_docai"
    frontend_url: str = "http://localhost:3000"
    allowed_hosts: list[str] = ["localhost", "127.0.0.1"]
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "RS256"
    jwt_expires_minutes: int = 480
    upload_max_size_bytes: int = 10_485_760
    allowed_mime_types: list[str] = [
        "application/pdf",
        "text/plain",
        "image/png",
        "image/jpeg",
        "image/webp",
    ]
    cloud_run_region: str = "europe-west8"
    gcp_project_id: str = "ask-your-docai"
    google_identity_platform_client_id: str = ""
    secret_manager_path: str = "projects/ask-your-docai/secrets/"
    audit_log_enabled: bool = True

    def now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()