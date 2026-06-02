import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi, readJsonBody } from '@/server/workout/db'
import { getRecentBodyMetrics, logBodyMetric } from '@/server/workout/repository'
import { bodyMetricInputSchema } from '@/server/workout/types'

export const Route = createFileRoute('/api/workout/body-metrics')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') ?? '180')
        return Response.json({ metrics: await getRecentBodyMetrics(limit) })
      },
      POST: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        const body = bodyMetricInputSchema.parse(await readJsonBody(request))
        return Response.json({ metric: await logBodyMetric(body) })
      },
    },
  },
})
