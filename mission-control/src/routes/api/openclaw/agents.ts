import { createFileRoute } from '@tanstack/react-router'
import { listAgents } from 'app/server/openclawGateway'
import { guardMcApi } from '@/server/requireMcApi'

export const Route = createFileRoute('/api/openclaw/agents')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardMcApi(request)
        if (denied) return denied
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

