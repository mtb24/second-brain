import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'
import { generateWeekPlan } from '@/server/workout/repository'

export const Route = createFileRoute('/api/workout/plan/generate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        return Response.json({ sessions: await generateWeekPlan('ui') })
      },
    },
  },
})
