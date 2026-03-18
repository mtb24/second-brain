# Phase 2 — Cursor Composer Prompt
## Paste this entire prompt into Cursor Composer (Cmd+Shift+I)

---

Build a FastAPI application called `ingest-api` with the following
specification. Create all files needed to run it in Docker.

## Core responsibility

This service is the normalisation layer for a personal second brain
system. Everything that enters the brain passes through here. It
accepts raw input (text, audio, or URL), processes it, classifies it,
and inserts a typed record into a Postgres database.

## Tech stack

- Python 3.12
- FastAPI with async support
- asyncpg for database access
- httpx for calling Ollama
- pydantic for request/response models
- Docker + docker-compose compatible

## Endpoints

### POST /ingest

Accepts one of three input types (use a discriminated union):

**Text input:**
```json
{
  "type": "text",
  "content": "string",
  "source": "string (optional, e.g. 'ios_voice', 'web', 'manual')"
}
```

**Audio input:**
```json
{
  "type": "audio",
  "audio_base64": "base64 encoded audio file",
  "source": "ios_voice"
}
```

**URL input:**
```json
{
  "type": "url",
  "url": "https://...",
  "source": "browser"
}
```

Processing pipeline for each type:
1. **Audio:** POST to Ollama Whisper endpoint to transcribe to text
2. **URL:** Fetch page content, extract readable text (use readability-lxml)
3. **Text:** Use as-is

Then for all types:
4. Call Ollama llama3.2 to classify the content into one of:
   `note | code | recipe | task | bookmark | journal | trading_research`
   Use this exact system prompt:
   ```
   You are a content classifier. Given a piece of text, return ONLY
   a single word from this list: note, code, recipe, task, bookmark,
   journal, trading_research. No explanation. Just the word.
   ```
5. Insert into the `thoughts` table in Postgres
6. POST to the internal /embed endpoint (fire and forget — don't wait)
7. Return the created thought record

Response:
```json
{
  "id": "uuid",
  "domain_tag": "note",
  "content": "string",
  "source": "string",
  "created_at": "iso8601"
}
```

### POST /embed

Internal endpoint — called after /ingest to generate and store the
vector embedding.

Input: `{ "thought_id": "uuid" }`

Processing:
1. Fetch the thought content from Postgres by ID
2. POST content to Ollama nomic-embed-text to get a 768-dim vector
3. UPDATE the thoughts table, setting the embedding column
4. Return `{ "success": true }`

### GET /queue-sync

Processes queued audio files for offline capture.

- Scan the `/app/queue/` directory for `.m4a` and `.wav` files
- For each file: read it, base64 encode it, POST to /ingest as audio type
- On success: delete the file
- Return `{ "processed": N, "errors": [] }`

### GET /health

Returns `{ "status": "ok", "db": "connected", "ollama": "reachable" }`
Checks both DB connection and Ollama reachability.

## Authentication

All endpoints except /health require a Bearer token header:
`Authorization: Bearer {API_SECRET}`

Read API_SECRET from environment variable. Return 401 if missing or wrong.

## Environment variables

```
DATABASE_URL=postgresql://user:pass@db:5432/brain
OLLAMA_URL=http://host-gateway:11434
EMBED_MODEL=nomic-embed-text
CHAT_MODEL=llama3.2
API_SECRET=secret
```

## Database schema (already exists — do not create)

```sql
thoughts (
  id uuid,
  content text,
  domain_tag text,
  source text,
  metadata jsonb,
  embedding vector(768),
  created_at timestamptz
)
```

## Error handling

- If Ollama classification fails or returns unexpected output,
  default domain_tag to "note" and log a warning
- If Ollama transcription fails for audio, return 422 with detail
- All database errors should return 500 with detail
- Never crash on embed failure — it's async best-effort

## Files to create

- `main.py` — FastAPI app entry point
- `routers/ingest.py` — /ingest and /embed endpoints
- `routers/queue.py` — /queue-sync endpoint
- `routers/health.py` — /health endpoint
- `services/ollama.py` — Ollama API client (transcribe, classify, embed)
- `services/database.py` — asyncpg connection pool and queries
- `models/thought.py` — Pydantic models
- `Dockerfile` — Python 3.12 slim, non-root user
- `requirements.txt` — all dependencies with pinned versions
- `README.md` — how to run locally and how to test each endpoint

## After creating all files, also provide

A `test_ingest.sh` bash script that tests all three input types
against a running instance using curl, with example outputs.
