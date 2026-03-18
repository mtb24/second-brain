#!/usr/bin/env bash
# Test text and URL ingest against a running ingest-api.
# Usage: API_SECRET=secret [BASE_URL=http://localhost:8000] ./test_ingest.sh

set -e
BASE_URL="${BASE_URL:-http://localhost:8000}"
API_SECRET="${API_SECRET:?Set API_SECRET}"

echo "=== 1. GET /health ==="
curl -s "${BASE_URL}/health" | jq .
echo ""

echo "=== 2. POST /ingest (text) ==="
curl -s -X POST "${BASE_URL}/ingest" \
  -H "Authorization: Bearer ${API_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"type":"text","content":"Buy milk and eggs","source":"manual"}' | jq .
echo ""

echo "=== 3. POST /ingest (URL) ==="
curl -s -X POST "${BASE_URL}/ingest" \
  -H "Authorization: Bearer ${API_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"type":"url","url":"https://example.com","source":"browser"}' | jq .
echo ""

echo "Done. Example outputs above."
