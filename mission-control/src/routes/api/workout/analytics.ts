import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'
import { getAnalytics } from '@/server/workout/repository'

export const Route = createFileRoute('/api/workout/analytics')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        const url = new URL(request.url)
        const range = url.searchParams.get('range')
        const safeRange = range === 'week' || range === 'quarter' ? range : 'month'
        return Response.json(await getAnalytics(safeRange))
      },
    },
  },
})
