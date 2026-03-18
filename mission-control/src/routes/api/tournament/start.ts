// src/routes/api/tournament/start.ts
import { createFileRoute } from '@tanstack/react-router'
const INGEST_URL = process.env.INGEST_URL
const INGEST_TOKEN = process.env.INGEST_TOKEN
export const Route = createFileRoute('/api/tournament/start')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!INGEST_URL || !INGEST_TOKEN) {
          return Response.json({ ok: false, error: 'INGEST_URL and INGEST_TOKEN not configured' }, { status: 500 })
        }
        const body = await request.text()
        const upstream = new URL('/trading/tournament/start', INGEST_URL)
        try {
          const res = await fetch(upstream, {
            method: 'POST',
            headers: { Authorization: `Bearer ${INGEST_TOKEN}`, 'Content-Type': 'application/json' },
            body: body || '{}',
          })
          const text = await res.text()
          return new Response(text, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' } })
        } catch (err) {
          return Response.json({ ok: false, error: String(err) }, { status: 502 })
        }
      },
    },
  },
})
