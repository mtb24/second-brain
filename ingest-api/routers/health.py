"""GET /health: status, db, ollama, plus DB-only health."""

from fastapi import APIRouter, Request

from services.ollama import OllamaClient
from services.database import get_pool

router = APIRouter(prefix="", tags=["health"])


@router.get("/health")
async def health(request: Request):
    """Return status, db connection, and Ollama reachability."""
    app = request.app
    db_ok = False
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_ok = True
    except Exception:
        pass

    ollama_ok = False
    try:
        ollama: OllamaClient = app.state.ollama
        ollama_ok = await ollama.check_reachable()
    except Exception:
        pass

    return {
        "status": "ok",
        "db": "connected" if db_ok else "disconnected",
        "ollama": "reachable" if ollama_ok else "unreachable",
    }


@router.get("/health/db")
async def health_db():
    """DB-only health check for Mission Control."""
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}
