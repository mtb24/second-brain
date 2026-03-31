import { createFileRoute } from '@tanstack/react-router'
import { guardMcApi } from '@/server/requireMcApi'

const INGEST_URL = process.env.INGEST_URL
const INGEST_TOKEN = process.env.INGEST_TOKEN

if (!INGEST_URL || !INGEST_TOKEN) {
  throw new Error('INGEST_URL and INGEST_TOKEN must be set in the environment')
}

export const Route = createFileRoute('/api/ingest/thoughts/recent')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardMcApi(request)
        if (denied) return denied
        const url = new URL(request.url)
        const upstream = new URL('/thoughts/recent', INGEST_URL)
        url.searchParams.forEach((value, key) => {
          upstream.searchParams.set(key, value)
        })

        const res = await fetch(upstream, {
          headers: {
            Authorization: `Bearer ${INGEST_TOKEN}`,
          },
        })

        const body = await res.text()
        return new Response(body, {
          status: res.status,
          headers: {
            'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
          },
        })
      },
    },
  },
})

