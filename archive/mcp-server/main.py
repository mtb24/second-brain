import os
import json
import logging
import asyncpg
import httpx
from typing import Optional
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

DATABASE_URL = os.environ["DATABASE_URL"]
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://172.18.0.1:11434")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")
MCP_SECRET = os.environ["MCP_SECRET"]
INGEST_URL = os.environ.get("INGEST_URL", "http://ingest-api:8000/ingest")
API_SECRET = os.environ.get("API_SECRET", "")

db_pool = None


async def get_pool():
    global db_pool
    if db_pool is None:
        db_pool = await asyncpg.create_pool(DATABASE_URL)
    return db_pool


def auth(authorization: str = Header(...)):
    if authorization != f"Bearer {MCP_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


# -----------------------------------------------------------
# Request / Response models
# -----------------------------------------------------------

class SearchRequest(BaseModel):
    query: str
    domain: Optional[str] = None
    project_tag: Optional[str] = None
    visibility: Optional[str] = "personal"   # "personal" | "client"
    limit: int = 5


class SearchResult(BaseModel):
    id: str
    content: str
    domain_tag: str
    source: str
    metadata: dict
    created_at: str
    similarity: float


class SaveRequest(BaseModel):
    content: str
    domain: str
    project_tag: str
    visibility: str = "personal"
    source: str = "cursor"
    save: bool = False          # must be explicitly True to write back


class GetRelatedRequest(BaseModel):
    thought_id: str
    project_tag: Optional[str] = None
    visibility: Optional[str] = "personal"
    limit: int = 5


# -----------------------------------------------------------
# Embed helper
# -----------------------------------------------------------

async def embed(text: str) -> list[float]:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{OLLAMA_URL}/api/embeddings", json={
            "model": EMBED_MODEL,
            "prompt": text
        })
        return r.json()["embedding"]


# -----------------------------------------------------------
# Tools
# -----------------------------------------------------------

@app.post("/search")
async def search_brain(req: SearchRequest, authorization: str = Header(...)):
    auth(authorization)
    pool = await get_pool()

    query_embedding = await embed(req.query)
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    # Build WHERE clauses — always scope by project and visibility
    conditions = []
    params = [embedding_str, req.limit]

    if req.domain:
        params.append(req.domain)
        conditions.append(f"domain_tag = ${len(params)}")

    if req.project_tag:
        params.append(req.project_tag)
        conditions.append(f"metadata->>'project_tag' = ${len(params)}")

    if req.visibility == "client":
        # Client context: only see thoughts tagged to this project
        # Cannot see personal or other client thoughts
        params.append(req.project_tag)
        conditions.append(f"metadata->>'project_tag' = ${len(params)}")
    else:
        # Personal context: see personal thoughts and optionally project-scoped
        conditions.append(
            "(metadata->>'visibility' = 'personal' OR metadata->>'visibility' IS NULL)"
        )

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    sql = f"""
        SELECT
            id::text,
            content,
            domain_tag,
            source,
            metadata,
            created_at::text,
            1 - (embedding <=> $1::vector) AS similarity
        FROM thoughts
        {where}
        ORDER BY embedding <=> $1::vector
        LIMIT $2
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    results = []
    for row in rows:
        results.append({
            "id": row["id"],
            "content": row["content"],
            "domain_tag": row["domain_tag"],
            "source": row["source"],
            "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
            "created_at": row["created_at"],
            "similarity": round(float(row["similarity"]), 4)
        })

    return {"results": results, "query": req.query, "count": len(results)}


@app.post("/save")
async def save_thought(req: SaveRequest, authorization: str = Header(...)):
    auth(authorization)

    # Write-back gate — must be explicit
    if not req.save:
        return {
            "saved": False,
            "reason": "Write-back requires save=true. Say 'save this' to confirm."
        }

    # Client context extra confirmation already handled by save=true requirement
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            INGEST_URL,
            json={
                "type": "text",
                "content": req.content,
                "source": req.source,
                "metadata": {
                    "project_tag": req.project_tag,
                    "visibility": req.visibility
                }
            },
            headers={"Authorization": f"Bearer {API_SECRET}"}
        )

    if r.status_code == 200:
        data = r.json()
        return {
            "saved": True,
            "id": data["id"],
            "domain_tag": data["domain_tag"],
            "project_tag": req.project_tag,
            "visibility": req.visibility
        }
    else:
        raise HTTPException(status_code=500, detail=f"Ingest failed: {r.text}")


@app.post("/related")
async def get_related(req: GetRelatedRequest, authorization: str = Header(...)):
    auth(authorization)
    pool = await get_pool()

    # Fetch the source thought
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT content, embedding::text, metadata FROM thoughts WHERE id = $1::uuid",
            req.thought_id
        )

    if not row:
        raise HTTPException(status_code=404, detail="Thought not found")

    # Enforce visibility — can only get related thoughts in same project scope
    source_meta = json.loads(row["metadata"]) if row["metadata"] else {}
    source_project = source_meta.get("project_tag")

    if req.project_tag and source_project != req.project_tag:
        raise HTTPException(
            status_code=403,
            detail="Cannot access thoughts outside current project scope"
        )

    conditions = [f"id != $2::uuid"]
    params = [row["embedding"], req.thought_id, req.limit]

    if req.project_tag:
        params.append(req.project_tag)
        conditions.append(f"metadata->>'project_tag' = ${len(params)}")

    if req.visibility == "client":
        params.append(req.project_tag)
        conditions.append(f"metadata->>'project_tag' = ${len(params)}")
    else:
        conditions.append(
            "(metadata->>'visibility' = 'personal' OR metadata->>'visibility' IS NULL)"
        )

    where = "WHERE " + " AND ".join(conditions)

    sql = f"""
        SELECT
            id::text,
            content,
            domain_tag,
            metadata,
            created_at::text,
            1 - (embedding <=> $1::vector) AS similarity
        FROM thoughts
        {where}
        ORDER BY embedding <=> $1::vector
        LIMIT $3
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    results = []
    for row in rows:
        results.append({
            "id": row["id"],
            "content": row["content"],
            "domain_tag": row["domain_tag"],
            "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
            "created_at": row["created_at"],
            "similarity": round(float(row["similarity"]), 4)
        })

    return {"results": results, "source_id": req.thought_id, "count": len(results)}


@app.get("/health")
async def health():
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db = "connected"
    except Exception:
        db = "error"
    return {"status": "ok", "db": db}
