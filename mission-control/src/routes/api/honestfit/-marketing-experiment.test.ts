import { describe, expect, it, vi } from 'vitest'

const getCurrentMock = vi.hoisted(() => vi.fn())
const applyActionMock = vi.hoisted(() => vi.fn())

vi.mock('@/server/honestFitMarketingExperiment', () => ({
  getCurrentHonestFitMarketingExperiment: getCurrentMock,
  applyHonestFitMarketingExperimentAction: applyActionMock,
}))

const {
  handleGetHonestFitMarketingExperimentRequest,
  handlePatchHonestFitMarketingExperimentRequest,
} = await import('./marketing-experiment')

describe('/api/honestfit/marketing-experiment auth', () => {
  it('rejects unauthenticated reads before hitting storage', async () => {
    const response = await handleGetHonestFitMarketingExperimentRequest(
      new Request('https://mission.kendowney.com/api/honestfit/marketing-experiment'),
    )

    expect(response.status).toBe(401)
    expect(getCurrentMock).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated mutations before hitting storage', async () => {
    const response = await handlePatchHonestFitMarketingExperimentRequest(
      new Request('https://mission.kendowney.com/api/honestfit/marketing-experiment', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reset' }),
      }),
    )

    expect(response.status).toBe(401)
    expect(applyActionMock).not.toHaveBeenCalled()
  })
})
