import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'
import { getNextSession } from '@/server/workout/repository'

export const Route = createFileRoute('/api/workout/plan/next')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        return Response.json({ session: await getNextSession() })
      },
    },
  },
})
