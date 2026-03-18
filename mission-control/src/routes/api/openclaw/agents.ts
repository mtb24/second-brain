import { createFileRoute } from '@tanstack/react-router'
import { listAgents } from 'app/server/openclawGateway'

export const Route = createFileRoute('/api/openclaw/agents')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const agents = await listAgents()
          return Response.json(agents)
        } catch (e) {
          console.error('Failed to fetch OpenClaw agents', e)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch agents' }),
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

