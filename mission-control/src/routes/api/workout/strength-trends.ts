import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'
import { getStrengthTrends } from '@/server/workout/repository'

export const Route = createFileRoute('/api/workout/strength-trends')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') ?? '240')
        return Response.json({ trends: await getStrengthTrends(limit) })
      },
    },
  },
})
