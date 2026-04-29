import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'
import { startSession } from '@/server/workout/repository'

export const Route = createFileRoute('/api/workout/sessions/$id/start')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        return Response.json({ session: await startSession(params.id, 'ui') })
      },
    },
  },
})
