import { createFileRoute } from '@tanstack/react-router'
import { guardMcApi } from '@/server/requireMcApi'

const MCP_URL = process.env.MCP_URL
const MCP_TOKEN = process.env.MCP_TOKEN

if (!MCP_URL || !MCP_TOKEN) {
  throw new Error('MCP_URL and MCP_TOKEN must be set in the environment')
}

export const Route = createFileRoute('/api/mcp/search-brain')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = guardMcApi(request)
        if (denied) return denied
        const body = await request.text()

        const res = await fetch(MCP_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${MCP_TOKEN}`,
            'Content-Type':
              request.headers.get('Content-Type') ?? 'application/json',
          },
          body,
        })

        const text = await res.text()

        return new Response(text, {
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

