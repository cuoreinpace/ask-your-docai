from datetime import datetime, timezone

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    app_name: str = "ask-your-docai"
    environment: str = "development"
    database_url: str = "postgresql://benjamindeornelas@localhost:5432/ask_docai"
    frontend_url: str = "http://localhost:3000"
    allowed_hosts: str = "*"
    jwt_secret: str = "dev-secret-change-me-please-32-chars-min"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 480
    upload_max_size_bytes: int = 10_485_760
    audit_log_enabled: bool = True
    cloud_run_region: str = "europe-west8"
    gcp_project_id: str = "ask-your-docai"
    google_identity_platform_client_id: str = ""
    secret_manager_path: str = "projects/ask-your-docai/secrets/"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_url.split(",") if o.strip()]

    def now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()


settings = Settings()
