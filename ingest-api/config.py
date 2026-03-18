"""App config from environment."""

import os


def get_database_url() -> str:
    return os.environ.get("DATABASE_URL", "postgresql://user:pass@localhost:5432/brain")


def get_ollama_url() -> str:
    return os.environ.get("OLLAMA_URL", "http://localhost:11434")


def get_embed_model() -> str:
    return os.environ.get("EMBED_MODEL", "nomic-embed-text")


def get_chat_model() -> str:
    return os.environ.get("CHAT_MODEL", "llama3.2")


def get_api_secret() -> str:
    return os.environ.get("API_SECRET", "")


def get_internal_base_url() -> str:
    """Base URL for internal callbacks (e.g. fire-and-forget /embed)."""
    return os.environ.get("INTERNAL_BASE_URL", "http://localhost:8000")
