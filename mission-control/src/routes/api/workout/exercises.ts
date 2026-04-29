import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'
import { getExercises } from '@/server/workout/repository'

export const Route = createFileRoute('/api/workout/exercises')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        return Response.json({ exercises: await getExercises() })
      },
    },
  },
})
