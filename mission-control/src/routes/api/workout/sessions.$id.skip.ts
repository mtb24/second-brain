import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'
import { skipSession } from '@/server/workout/repository'

export const Route = createFileRoute('/api/workout/sessions/$id/skip')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        return Response.json({ session: await skipSession(params.id, 'ui') })
      },
    },
  },
})
