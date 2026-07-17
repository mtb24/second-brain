import { createFileRoute } from '@tanstack/react-router'
import { fetchHonestFitMissionSummary } from '@/server/honestFitMissionSummary'
import { guardMcApi } from '@/server/requireMcApi'

export const Route = createFileRoute('/api/honestfit/mission-summary')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardMcApi(request)
        if (denied) return denied

        return Response.json(await fetchHonestFitMissionSummary(), {
          headers: {
            'Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
