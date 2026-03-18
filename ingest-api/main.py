"""FastAPI ingest-api: normalization layer for second brain."""

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, status
from fastapi.responses import JSONResponse

from config import (
    get_chat_model,
    get_database_url,
    get_embed_model,
    get_ollama_url,
)
from routers import health, ingest
from services.database import close_pool, init_pool
from services.ollama import OllamaClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def verify_bearer(request: Request):
    """Dependency: require Authorization Bearer token matching API_SECRET."""
    from config import get_api_secret
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Missing or invalid Authorization header"},
        )
    token = auth[7:].strip()
    if not token or token != get_api_secret():
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid token"},
        )
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool(get_database_url())
    app.state.ollama = OllamaClient(
        base_url=get_ollama_url(),
        chat_model=get_chat_model(),
        embed_model=get_embed_model(),
    )
    yield
    await close_pool()


app = FastAPI(
    title="ingest-api",
    description="Normalization layer for personal second brain",
    lifespan=lifespan,
)

# Health is public
app.include_router(health.router)

# All other routes require Bearer auth
app.include_router(ingest.router, dependencies=[Depends(verify_bearer)])