import { createFileRoute } from '@tanstack/react-router'
import { fetchHonestFitMissionSummary } from '@/server/honestFitMissionSummary'
import { guardMcApi } from '@/server/requireMcApi'

export const Route = createFileRoute('/api/honestfit/mission-summary')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardMcApi(request)
        if (denied) return denied

        const url = new URL(request.url)
        return Response.json(
          await fetchHonestFitMissionSummary({
            since: url.searchParams.get('since'),
          }),
          {
          headers: {
            'Cache-Control': 'no-store',
          },
          },
        )
      },
    },
  },
})
