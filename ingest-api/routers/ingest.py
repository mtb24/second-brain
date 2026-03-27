"""POST /ingest and POST /embed endpoints, plus read/query helpers for Mission Control."""

import asyncio
import logging
import json

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from config import get_internal_base_url, get_api_secret
from models.thought import (
    EmbedRequest,
    EmbedResponse,
    IngestInput,
    IngestResponse,
    TextIngestInput,
    URLIngestInput,
)
from services.database import (
    get_thought_by_id,
    insert_thought,
    update_embedding,
    get_pool,
)
from services.ollama import OllamaClient
from utils.url_fetch import fetch_readable_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["ingest"])


def get_ollama(request: Request) -> OllamaClient:
    return request.app.state.ollama


async def _normalize_to_text(payload: IngestInput, ollama: OllamaClient) -> tuple[str, str | None]:
    """Return (content, source)."""
    if isinstance(payload, TextIngestInput):
        return payload.content, payload.source
    if isinstance(payload, URLIngestInput):
        try:
            text = await fetch_readable_text(payload.url)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"URL fetch failed: {e}")
        return text, payload.source
    raise HTTPException(status_code=422, detail="Unsupported input type")


@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    payload: IngestInput,
    ollama: OllamaClient = Depends(get_ollama),
):
    """Normalize input to text, classify, store, trigger embed (fire-and-forget), return thought."""
    content, source = await _normalize_to_text(payload, ollama)
    domain_tag = await ollama.classify_content(content)

    extra_metadata: dict | None = None
    if isinstance(payload, TextIngestInput) and payload.metadata:
        extra_metadata = payload.metadata

    try:
        row = await insert_thought(
            content=content,
            domain_tag=domain_tag,
            source=source,
            metadata=extra_metadata,
        )
    except Exception as e:
        logger.exception("Database insert failed")
        raise HTTPException(status_code=500, detail=str(e))

    thought_id = row["id"]
    base = get_internal_base_url()
    secret = get_api_secret()

    async def trigger_embed():
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                await client.post(
                    f"{base}/embed",
                    json={"thought_id": str(thought_id)},
                    headers={"Authorization": f"Bearer {secret}"},
                )
        except Exception as e:
            logger.warning("Embed fire-and-forget failed: %s", e)

    asyncio.create_task(trigger_embed())

    return IngestResponse(
        id=thought_id,
        domain_tag=row["domain_tag"],
        content=row["content"],
        source=row["source"],
        created_at=row["created_at"],
    )


@router.post("/embed", response_model=EmbedResponse)
async def embed(
    body: EmbedRequest,
    ollama: OllamaClient = Depends(get_ollama),
):
    """Internal: generate embedding for a thought and store it."""
    thought_id = body.thought_id
    row = await get_thought_by_id(thought_id)
    if not row:
        raise HTTPException(status_code=404, detail="Thought not found")

    try:
        embedding = await ollama.embed_text(row["content"])
    except Exception as e:
        logger.warning("Ollama embed failed for %s: %s", thought_id, e)
        return EmbedResponse(success=False)

    try:
        await update_embedding(thought_id, embedding)
    except Exception as e:
        logger.exception("Database update embedding failed")
        raise HTTPException(status_code=500, detail=str(e))

    return EmbedResponse(success=True)


DEFAULT_BRACKET_RULES = [
    {"tier": "incubator", "duration_days": 30, "threshold_pct": 8},
    {"tier": "challenger", "duration_days": 60, "threshold_pct": 12},
    {"tier": "champion", "duration_days": 90, "threshold_pct": 0},
]


@router.get("/thoughts/recent")
async def thoughts_recent(
    domain_tag: str | None = None,
    project_tag: str | None = None,
    source: str | None = None,
    limit: int = 100,
):
    """
    Recent thoughts ordered by created_at desc.

    Optional query params:
      - domain_tag
      - project_tag
      - source
      - limit (default 100, max 500)
    """
    if limit <= 0:
        limit = 100
    if limit > 500:
        limit = 500

    pool = get_pool()
    conditions: list[str] = []
    params: list[object] = []

    if domain_tag:
        conditions.append(f"domain_tag = ${len(params) + 1}")
        params.append(domain_tag)
    if project_tag:
        conditions.append(f"metadata->>'project_tag' = ${len(params) + 1}")
        params.append(project_tag)
    if source:
        conditions.append(f"source = ${len(params) + 1}")
        params.append(source)

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    params.append(limit)
    sql = f"""
        SELECT id, content, domain_tag, source, metadata, created_at
        FROM thoughts
        {where_clause}
        ORDER BY created_at DESC
        LIMIT ${len(params)}
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    return [
        {
            "id": str(r["id"]),
            "content": r["content"],
            "domain_tag": r["domain_tag"],
            "project_tag": (json.loads(r["metadata"]) if isinstance(r["metadata"], str) else r["metadata"] or {}).get("project_tag"),
            "visibility": (json.loads(r["metadata"]) if isinstance(r["metadata"], str) else r["metadata"] or {}).get("visibility"),
            "source": r["source"],
            "metadata": r["metadata"],
            "created_at": (
                r["created_at"].isoformat()
                if hasattr(r["created_at"], "isoformat")
                else r["created_at"]
            ),
        }
        for r in rows
    ]


@router.get("/thoughts/activity")
async def thoughts_activity(
    source: str = "openclaw",
    project_tag: str | None = None,
    limit: int = 100,
):
    """
    Recent thoughts for a given source (default 'openclaw'), ordered by created_at desc.

    Optional query params:
      - source (default 'openclaw')
      - project_tag
      - limit (default 100, max 500)
    """
    if limit <= 0:
        limit = 100
    if limit > 500:
        limit = 500

    pool = get_pool()
    conditions: list[str] = [f"source = $1"]
    params: list[object] = [source]

    if project_tag:
        conditions.append(f"metadata->>'project_tag' = ${len(params) + 1}")
        params.append(project_tag)

    params.append(limit)
    where_clause = "WHERE " + " AND ".join(conditions)

    sql = f"""
        SELECT id, content, domain_tag, source, metadata, created_at
        FROM thoughts
        {where_clause}
        ORDER BY created_at DESC
        LIMIT ${len(params)}
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    return [
        {
            "id": str(r["id"]),
            "content": r["content"],
            "domain_tag": r["domain_tag"],
            "project_tag": (json.loads(r["metadata"]) if isinstance(r["metadata"], str) else r["metadata"] or {}).get("project_tag"),
            "visibility": (json.loads(r["metadata"]) if isinstance(r["metadata"], str) else r["metadata"] or {}).get("visibility"),
            "source": r["source"],
            "metadata": r["metadata"],
            "created_at": (
                r["created_at"].isoformat()
                if hasattr(r["created_at"], "isoformat")
                else r["created_at"]
            ),
        }
        for r in rows
    ]


@router.get("/trading/bracket")
async def get_trading_bracket():
    """
    Return current trading bracket config (domain_tag='trading_research', metadata.type='trading_bracket_config')
    or defaults when none exists.
    """
    pool = get_pool()
    sql = """
        SELECT metadata
        FROM thoughts
        WHERE domain_tag = 'trading_research'
          AND metadata->>'type' = 'trading_bracket_config'
        ORDER BY created_at DESC
        LIMIT 1
    """

    async with pool.acquire() as conn:
        row = await conn.fetchrow(sql)

    if not row or not row["metadata"]:
        return DEFAULT_BRACKET_RULES

    metadata = row["metadata"]
    rules = metadata.get("rules") if isinstance(metadata, dict) else None
    if not isinstance(rules, list):
        return DEFAULT_BRACKET_RULES

    try:
        out: list[dict] = []
        for r in rules:
            out.append(
                {
                    "tier": r["tier"],
                    "duration_days": int(r["duration_days"]),
                    "threshold_pct": float(r["threshold_pct"]),
                }
            )
        return out
    except Exception:
        return DEFAULT_BRACKET_RULES


@router.post("/trading/bracket")
async def set_trading_bracket(body: dict):
    """
    Validate and upsert trading bracket rules into OB1 as a single thought.

    Body: { "rules": [ { tier, duration_days, threshold_pct }, ... ] }
    """
    rules = body.get("rules")
    if not isinstance(rules, list):
        raise HTTPException(status_code=400, detail="rules must be a list")

    tiers = {"incubator", "challenger", "champion"}
    seen: set[str] = set()
    cleaned: list[dict] = []

    for r in rules:
        tier = r.get("tier")
        if tier not in tiers:
            raise HTTPException(status_code=400, detail=f"Invalid tier: {tier}")
        seen.add(tier)

        try:
            duration_days = int(r.get("duration_days"))
            threshold_pct = float(r.get("threshold_pct"))
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="duration_days and threshold_pct must be numbers",
            )

        if duration_days <= 0:
            raise HTTPException(
                status_code=400, detail="duration_days must be > 0"
            )
        if threshold_pct < 0:
            raise HTTPException(
                status_code=400, detail="threshold_pct must be >= 0"
            )

        cleaned.append(
            {
                "tier": tier,
                "duration_days": duration_days,
                "threshold_pct": threshold_pct,
            }
        )

    if seen != tiers:
        raise HTTPException(
            status_code=400,
            detail="All tiers incubator, challenger, champion must be present",
        )

    pool = get_pool()
    metadata = {
        "type": "trading_bracket_config",
        "rules": cleaned,
    }

    sql = """
        INSERT INTO thoughts (content, domain_tag, source, metadata, created_at)
        VALUES ($1, 'trading_research', 'mission-control', $2, NOW())
        RETURNING created_at
    """

    async with pool.acquire() as conn:
        created_at = await conn.fetchval(
            sql,
            "Trading bracket config updated",
            json.dumps(metadata),
        )

    return {
        "ok": True,
        "updated_at": (
            created_at.isoformat()
            if hasattr(created_at, "isoformat")
            else created_at
        ),
    }
