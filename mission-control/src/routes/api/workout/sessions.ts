import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'
import { listSessions } from '@/server/workout/repository'

export const Route = createFileRoute('/api/workout/sessions')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') ?? 30)
        return Response.json({ sessions: await listSessions(Number.isFinite(limit) ? limit : 30) })
      },
    },
  },
})
