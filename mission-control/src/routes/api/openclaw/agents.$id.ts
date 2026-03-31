import { createFileRoute } from '@tanstack/react-router'
import { getAgentDetail } from 'app/server/openclawGateway'
import { guardMcApi } from '@/server/requireMcApi'

export const Route = createFileRoute('/api/openclaw/agents/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const denied = guardMcApi(request)
        if (denied) return denied
        try {
          const detail = await getAgentDetail(params.id)
          return Response.json(detail)
        } catch (e) {
          console.error('Failed to fetch OpenClaw agent detail', e)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch agent detail' }),
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

