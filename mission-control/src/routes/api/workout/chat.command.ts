import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi, readJsonBody } from '@/server/workout/db'
import { executeWorkoutChatCommand } from '@/server/workout/chat'
import { chatCommandInputSchema } from '@/server/workout/types'

export const Route = createFileRoute('/api/workout/chat/command')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        const body = chatCommandInputSchema.parse(await readJsonBody(request))
        return Response.json(await executeWorkoutChatCommand(body))
      },
    },
  },
})
