import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi, readJsonBody } from '@/server/workout/db'
import { getProfile, patchProfile } from '@/server/workout/repository'
import { profilePatchSchema } from '@/server/workout/types'

export const Route = createFileRoute('/api/workout/profile')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        return Response.json(await getProfile())
      },
      PATCH: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        const body = profilePatchSchema.parse(await readJsonBody(request))
        return Response.json(await patchProfile(body, 'ui'))
      },
    },
  },
})
