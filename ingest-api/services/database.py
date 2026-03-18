"""Async Postgres connection pool and queries using asyncpg."""

import json
import logging


import asyncpg
from pgvector.asyncpg import register_vector

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def _on_connect(conn):
    """Register pgvector type on each new connection."""
    await register_vector(conn)


async def init_pool(database_url: str) -> None:
    """Create the connection pool."""
    global _pool
    _pool = await asyncpg.create_pool(
        database_url,
        min_size=2,
        max_size=10,
        command_timeout=60,
        init=_on_connect,
    )
    logger.info("Database pool initialized")


async def close_pool() -> None:
    """Close the connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Database pool closed")


def get_pool() -> asyncpg.Pool:
    """Return the current pool. Raises if not initialized."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized")
    return _pool


async def insert_thought(
    content: str,
    domain_tag: str,
    source: str | None,
    metadata: dict | None = None,
) -> asyncpg.Record:
    """Insert a thought and return the created row."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO thoughts (content, domain_tag, source, metadata, created_at)
        VALUES ($1, $2, $3, $4::jsonb, NOW())
        RETURNING id, content, domain_tag, source, created_at
        """,
        content,
        domain_tag,
        source,
        json.dumps(metadata or {}),
    )
    return row


async def get_thought_by_id(thought_id: int) -> asyncpg.Record | None:
    """Fetch a thought by ID."""
    pool = get_pool()
    return await pool.fetchrow(
        "SELECT id, content, domain_tag, source, metadata, created_at FROM thoughts WHERE id = $1",
        thought_id,
    )


async def update_embedding(thought_id: int, embedding: list[float]) -> None:
    """Update the embedding column for a thought (768-dim vector)."""
    pool = get_pool()
    await pool.execute(
        "UPDATE thoughts SET embedding = $1 WHERE id = $2",
        embedding,
        thought_id,
    )
