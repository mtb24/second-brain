import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'

const commands = [
  "what's next?",
  'show my plan for this week',
  'log this set: 10 reps at 275 pounds',
  'start this exercise: incline bench machine',
  'record 5x5 at 185 on squat',
  'mark bench complete',
  'make next week a deload',
  'swap deadlift for RDL',
  'how much volume did I do on legs last month?',
  'what are my PRs on bench?',
  'what weight am I doing for this set?',
  "reschedule today's session to tomorrow",
  'set my equipment to dumbbells only',
  'note that my left knee is irritated',
  "log today's weight: 205 lb",
  'log my chest measurement: 44 inches',
]

export const Route = createFileRoute('/api/workout/chat/help')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        return Response.json({ commands })
      },
    },
  },
})
