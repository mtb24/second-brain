// src/routes/api/tournament/start.ts
import { createFileRoute } from '@tanstack/react-router'
import { guardMcApi } from '@/server/requireMcApi'

const TOURNAMENT_URL = process.env.TOURNAMENT_URL ?? 'http://127.0.0.1:3001'

export const Route = createFileRoute('/api/tournament/start')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = guardMcApi(request)
        if (denied) return denied
        const body = await request.text()
        const upstream = new URL('/start', TOURNAMENT_URL)
        // Fire and forget — a round takes O(minutes); don't hold the browser
        // connection open. The client polls /api/tournament/rounds for results.
        fetch(upstream, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body || '{}',
        }).catch((err) => console.error('[tournament/start] round failed:', err))
        return Response.json({ ok: true, started: true }, { status: 202 })
      },
    },
  },
})
