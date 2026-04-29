import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi, readJsonBody } from '@/server/workout/db'
import { addSetToPerformance } from '@/server/workout/repository'
import { setEntryInputSchema } from '@/server/workout/types'

export const Route = createFileRoute('/api/workout/exercise-performances/$id/sets')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        const body = setEntryInputSchema.parse(await readJsonBody(request))
        return Response.json(await addSetToPerformance(params.id, body))
      },
    },
  },
})
