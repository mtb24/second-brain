import { createFileRoute } from '@tanstack/react-router'
import { guardWorkoutApi } from '@/server/workout/db'
import { getAuditLog } from '@/server/workout/repository'

export const Route = createFileRoute('/api/workout/audit')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardWorkoutApi(request)
        if (denied) return denied
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') ?? 100)
        return Response.json({ audit: await getAuditLog(Number.isFinite(limit) ? limit : 100) })
      },
    },
  },
})
