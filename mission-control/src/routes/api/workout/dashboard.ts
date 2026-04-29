import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'
import { getDashboard } from '@/server/workout/repository'

export const Route = createFileRoute('/api/workout/dashboard')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        return Response.json(await getDashboard())
      },
    },
  },
})
