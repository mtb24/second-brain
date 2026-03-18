import { createFileRoute } from '@tanstack/react-router'

const INGEST_URL = process.env.INGEST_URL
const INGEST_TOKEN = process.env.INGEST_TOKEN

if (!INGEST_URL || !INGEST_TOKEN) {
  throw new Error('INGEST_URL and INGEST_TOKEN must be set in the environment')
}

export const Route = createFileRoute('/api/ingest/trading/bracket')({
  server: {
    handlers: {
      GET: async () => {
        const upstream = new URL('/trading/bracket', INGEST_URL)
        const res = await fetch(upstream, {
          headers: {
            Authorization: `Bearer ${INGEST_TOKEN}`,
          },
        })
        const body = await res.text()
        return new Response(body, {
          status: res.status,
          headers: {
            'Content-Type':
              res.headers.get('Content-Type') ?? 'application/json',
          },
        })
      },
      POST: async ({ request }) => {
        const upstream = new URL('/trading/bracket', INGEST_URL)
        const res = await fetch(upstream, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${INGEST_TOKEN}`,
            'Content-Type': request.headers.get('Content-Type') ?? 'application/json',
          },
          body: await request.text(),
        })
        const body = await res.text()
        return new Response(body, {
          status: res.status,
          headers: {
            'Content-Type':
              res.headers.get('Content-Type') ?? 'application/json',
          },
        })
      },
    },
  },
})

