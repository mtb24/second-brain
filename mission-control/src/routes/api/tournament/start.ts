// src/routes/api/tournament/start.ts
import { createFileRoute } from '@tanstack/react-router'

const TOURNAMENT_URL = process.env.TOURNAMENT_URL ?? 'http://127.0.0.1:3001'

export const Route = createFileRoute('/api/tournament/start')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text()
        const upstream = new URL('/start', TOURNAMENT_URL)
        try {
          const res = await fetch(upstream, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body || '{}',
          })
          const text = await res.text()
          return new Response(text, {
            status: res.status,
            headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
          })
        } catch (err) {
          return Response.json({ ok: false, error: String(err) }, { status: 502 })
        }
      },
    },
  },
})
