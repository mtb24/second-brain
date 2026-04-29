import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'
import { dateInTimeZone } from '@/server/workout/date'
import { getProfile, getSessionForDate } from '@/server/workout/repository'

export const Route = createFileRoute('/api/workout/plan/today')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        const profile = await getProfile()
        const today = dateInTimeZone(profile.timezone)
        return Response.json({ today, session: await getSessionForDate(today) })
      },
    },
  },
})
