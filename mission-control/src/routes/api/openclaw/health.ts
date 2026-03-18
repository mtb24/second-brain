import { createFileRoute } from '@tanstack/react-router'
import { getHealthSnapshot } from 'app/server/openclawGateway'

export const Route = createFileRoute('/api/openclaw/health')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const snapshot = await getHealthSnapshot()
          return Response.json(snapshot)
        } catch (e) {
          console.error('Failed to fetch OpenClaw health', e)
          return new Response(
            JSON.stringify({
              ok: false,
              error: 'Failed to reach OpenClaw gateway',
            }),
            {
              status: 502,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})

