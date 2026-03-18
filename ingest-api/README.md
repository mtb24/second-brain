# ingest-api

Normalization layer for a personal second brain. Accepts raw input (text or URL), processes it, classifies it, and inserts a typed record into Postgres. All endpoints except `/health` require a Bearer token.

## Tech stack

- Python 3.12, FastAPI (async), asyncpg, httpx, pydantic
- Docker + docker-compose compatible

## Environment variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `postgresql://user:pass@db:5432/brain` |
| `OLLAMA_URL` | Ollama API base URL | `http://host-gateway:11434` |
| `EMBED_MODEL` | Embedding model name | `nomic-embed-text` |
| `CHAT_MODEL` | Chat model for classification | `llama3.2` |
| `API_SECRET` | Bearer token for auth | `secret` |
| `INTERNAL_BASE_URL` | Base URL for internal callbacks (e.g. /embed) | `http://localhost:8000` |

## Database

The `thoughts` table (and pgvector extension) must already exist. Example schema:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE thoughts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text,
  domain_tag text,
  source text,
  metadata jsonb,
  embedding vector(768),
  created_at timestamptz DEFAULT NOW()
);
```

## Run locally

1. Create a virtualenv and install deps:

   ```bash
   python3.12 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Set env vars (or use a `.env` file with a loader):

   ```bash
   export DATABASE_URL=postgresql://user:pass@localhost:5432/brain
   export OLLAMA_URL=http://localhost:11434
   export API_SECRET=secret
   export INTERNAL_BASE_URL=http://localhost:8000
   ```

3. Start the API:

   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

## Run with Docker

Build and run with docker-compose (example; adjust to your stack):

```yaml
services:
  ingest-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/brain
      OLLAMA_URL: http://host.docker.internal:11434
      API_SECRET: secret
      INTERNAL_BASE_URL: http://ingest-api:8000
```

Then:

```bash
docker compose up -d ingest-api
```

## Endpoints

### GET /health (no auth)

Returns `{ "status": "ok", "db": "connected"|"disconnected", "ollama": "reachable"|"unreachable" }`.

```bash
curl -s http://localhost:8000/health
```

### POST /ingest (auth required)

Accepts a discriminated union: `text` or `url`.

- **Text:** `{ "type": "text", "content": "...", "source": "optional" }`
- **URL:** `{ "type": "url", "url": "https://...", "source": "browser" }`

Pipeline: URL → fetch + readability; text → as-is. Then classify via Ollama (note, code, recipe, task, bookmark, journal, trading_research), insert into `thoughts`, trigger `/embed` fire-and-forget, return the created thought.

```bash
export API_SECRET=secret
curl -s -X POST http://localhost:8000/ingest \
  -H "Authorization: Bearer $API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"text","content":"Buy milk","source":"manual"}'
```

### POST /embed (auth required, internal)

Input: `{ "thought_id": "uuid" }`. Generates embedding via Ollama and updates the row. Returns `{ "success": true }`.

## Testing each endpoint

Use the provided script (see below) or:

1. **Health:** `curl http://localhost:8000/health`
2. **Ingest text:** `curl -X POST ... -H "Authorization: Bearer $API_SECRET" -d '{"type":"text","content":"Hello","source":"web"}' http://localhost:8000/ingest`
3. **Ingest URL:** same with `{"type":"url","url":"https://example.com","source":"browser"}`

## Test script

Run `./test_ingest.sh` against a running instance (set `API_SECRET` and optionally `BASE_URL`). It exercises text and URL ingest and prints example outputs.
