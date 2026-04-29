import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'
import { getSessionById } from '@/server/workout/repository'

export const Route = createFileRoute('/api/workout/sessions/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        const session = await getSessionById(params.id)
        return session
          ? Response.json({ session })
          : Response.json({ error: 'Workout session not found' }, { status: 404 })
      },
    },
  },
})
