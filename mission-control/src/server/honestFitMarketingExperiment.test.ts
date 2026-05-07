import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
}))

function makeRow(patch: Record<string, unknown> = {}) {
  const id = String(patch.id ?? 'honestfit-trust-layer-linkedin-v1')
  return {
    id,
    title: 'Trust Layer public profile LinkedIn post',
    hypothesis: 'Test whether the message is understandable.',
    channel: 'linkedin',
    target_url: 'https://honestfit.ai/c/ken-downey',
    post_draft: 'Post draft',
    post_body: 'Post draft',
    hook: 'A resume is a list of claims.',
    angle: 'Problem-first',
    audience: 'Recruiters',
    suggested_screenshot: 'Public profile',
    feedback_ask: 'What is confusing?',
    status: 'ready',
    post_url: null,
    posted_url: null,
    posted_at: null,
    check_after_hours: 24,
    check_after: null,
    learning_what_happened: '',
    learning_what_was_confusing: '',
    next_message_angle: '',
    created_at: '2026-05-04T15:00:00.000Z',
    updated_at: '2026-05-04T15:00:00.000Z',
    ...patch,
  }
}

function upsert(row: Record<string, unknown>) {
  const index = state.rows.findIndex((candidate) => candidate.id === row.id)
  if (index === -1) state.rows.push(row)
  else state.rows[index] = { ...state.rows[index], ...row }
}

const fakeClient = {
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('ALTER TABLE') || sql.includes('ADD CONSTRAINT')) {
      return { rows: [] }
    }

    if (sql.includes('INSERT INTO honestfit_marketing_experiments')) {
      if (sql.includes('ON CONFLICT')) {
        const id = String(params?.[0])
        if (!state.rows.some((row) => row.id === id)) {
          upsert(
            makeRow({
              id,
              title: params?.[1],
              hypothesis: params?.[2],
              channel: params?.[3],
              target_url: params?.[4],
              post_draft: params?.[5],
              post_body: params?.[5],
              hook: params?.[6],
              angle: params?.[7],
              audience: params?.[8],
              suggested_screenshot: params?.[9],
              feedback_ask: params?.[10],
              status: params?.[11],
            }),
          )
        }
      } else {
        upsert(
          makeRow({
            id: params?.[0],
            title: params?.[1],
            hypothesis: params?.[2],
            channel: params?.[3],
            target_url: params?.[4],
            post_draft: params?.[5],
            post_body: params?.[5],
            hook: params?.[6],
            angle: params?.[7],
            audience: params?.[8],
            suggested_screenshot: params?.[9],
            feedback_ask: params?.[10],
            status: params?.[11],
            post_url: params?.[12],
            posted_url: params?.[12],
            posted_at: params?.[13],
            check_after: params?.[14],
            learning_what_happened: params?.[15],
            learning_what_was_confusing: params?.[16],
            next_message_angle: params?.[17],
          }),
        )
      }
      return { rows: [] }
    }

    if (sql.includes('SELECT *') && sql.includes('WHERE id = $1')) {
      return {
        rows: state.rows.filter((row) => row.id === params?.[0]).slice(0, 1),
      }
    }

    if (sql.includes('SELECT *')) {
      return { rows: state.rows }
    }

    if (sql.includes('UPDATE honestfit_marketing_experiments')) {
      const row = makeRow({
        id: params?.[0],
        title: params?.[1],
        hypothesis: params?.[2],
        channel: params?.[3],
        target_url: params?.[4],
        post_draft: params?.[5],
        post_body: params?.[5],
        hook: params?.[6],
        angle: params?.[7],
        audience: params?.[8],
        suggested_screenshot: params?.[9],
        feedback_ask: params?.[10],
        status: params?.[11],
        post_url: params?.[12],
        posted_url: params?.[12],
        posted_at: params?.[13],
        check_after: params?.[14],
        learning_what_happened: params?.[15],
        learning_what_was_confusing: params?.[16],
        next_message_angle: params?.[17],
        updated_at: '2026-05-04T16:00:00.000Z',
      })
      upsert(row)
      return { rows: [row] }
    }

    return { rows: [] }
  }),
}

vi.mock('./workout/db', () => ({
  getWorkoutPool: () => fakeClient,
  withWorkoutTransaction: async <T>(fn: (client: typeof fakeClient) => Promise<T>) =>
    fn(fakeClient),
}))

const {
  applyHonestFitMarketingExperimentAction,
  getCurrentHonestFitMarketingExperiment,
} = await import('./honestFitMarketingExperiment')

describe('HonestFit marketing campaign persistence', () => {
  beforeEach(() => {
    state.rows = []
    fakeClient.query.mockClear()
  })

  it('loads the seeded campaign queue', async () => {
    const result = await getCurrentHonestFitMarketingExperiment()

    expect(result.campaigns.length).toBeGreaterThanOrEqual(5)
    expect(result.campaigns.map((campaign) => campaign.angle)).toContain(
      'Problem-first',
    )
    expect(result.campaigns.map((campaign) => campaign.angle)).toContain(
      'Recruiter-value',
    )
  })

  it('marks a selected campaign posted and preserves the queue', async () => {
    const initial = await getCurrentHonestFitMarketingExperiment()
    const campaignId = initial.selectedCampaignId

    const result = await applyHonestFitMarketingExperimentAction({
      action: 'mark_posted',
      campaignId,
      postedUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:123',
      postedAt: '2026-05-04T16:00:00.000Z',
    })
    const campaign = result.campaigns.find((item) => item.id === campaignId)

    expect(campaign?.status).toBe('waiting_for_data')
    expect(campaign?.postedUrl).toBe(
      'https://www.linkedin.com/feed/update/urn:li:activity:123',
    )
    expect(result.campaigns.length).toBeGreaterThan(1)
  })

  it('saves learning without deleting previous campaign history', async () => {
    const initial = await getCurrentHonestFitMarketingExperiment()
    const campaignId = initial.selectedCampaignId

    const result = await applyHonestFitMarketingExperimentAction({
      action: 'save_learning',
      campaignId,
      learningWhatHappened: 'Profile clicks but no replies.',
      learningWhatWasConfusing: 'People missed evidence controls.',
      nextMessageAngle: 'Explain public versus private evidence.',
    })
    const campaign = result.campaigns.find((item) => item.id === campaignId)

    expect(campaign?.status).toBe('learning_captured')
    expect(campaign?.learningWhatHappened).toBe(
      'Profile clicks but no replies.',
    )
    expect(result.campaigns.some((item) => item.status === 'ready')).toBe(true)
  })

  it('starts the next campaign from a prepared draft', async () => {
    const initial = await getCurrentHonestFitMarketingExperiment()
    const ready = initial.campaigns.find(
      (campaign) => campaign.id === 'honestfit-candidate-control-linkedin-v2',
    )

    const result = await applyHonestFitMarketingExperimentAction({
      action: 'start_next_campaign',
      draftId: ready?.id ?? '',
    })
    const selected = result.campaigns.find(
      (campaign) => campaign.id === result.selectedCampaignId,
    )

    expect(selected?.status).toBe('draft')
    expect(selected?.angle).toBe('Candidate-control')
    expect(result.campaigns.some((campaign) => campaign.id === ready?.id)).toBe(
      true,
    )
  })
})
