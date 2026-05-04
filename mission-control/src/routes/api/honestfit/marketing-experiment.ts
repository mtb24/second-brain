import { createFileRoute } from '@tanstack/react-router'
import {
  applyHonestFitMarketingExperimentAction,
  getCurrentHonestFitMarketingExperiment,
} from '@/server/honestFitMarketingExperiment'
import { marketingExperimentActionSchema } from '@/lib/honestFitMarketingExperiment'
import { guardMcApi } from '@/server/requireMcApi'
import { readJsonBody } from '@/server/workout/db'

export async function handleGetHonestFitMarketingExperimentRequest(
  request: Request,
) {
  const denied = guardMcApi(request)
  if (denied) return denied

  return Response.json(await getCurrentHonestFitMarketingExperiment(), {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

export async function handlePatchHonestFitMarketingExperimentRequest(
  request: Request,
) {
  const denied = guardMcApi(request)
  if (denied) return denied

  const body = marketingExperimentActionSchema.parse(await readJsonBody(request))
  return Response.json(await applyHonestFitMarketingExperimentAction(body), {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

export const Route = createFileRoute('/api/honestfit/marketing-experiment')({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleGetHonestFitMarketingExperimentRequest(request),
      PATCH: async ({ request }) =>
        handlePatchHonestFitMarketingExperimentRequest(request),
    },
  },
})
