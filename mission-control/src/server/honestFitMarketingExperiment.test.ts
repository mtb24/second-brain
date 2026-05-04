import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
}))

function makeRow(patch: Record<string, unknown> = {}) {
  return {
    id: 'honestfit-trust-layer-linkedin-v1',
    title: 'Trust Layer public profile LinkedIn post',
    hypothesis: 'Test whether the message is understandable.',
    channel: 'linkedin',
    target_url: 'https://honestfit.ai/c/ken-downey',
    post_draft: 'Post draft',
    status: 'draft',
    post_url: null,
    posted_at: null,
    check_after_hours: 24,
    learning_what_happened: '',
    learning_what_was_confusing: '',
    next_message_angle: '',
    created_at: '2026-05-04T15:00:00.000Z',
    updated_at: '2026-05-04T15:00:00.000Z',
    ...patch,
  }
}

const fakeClient = {
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('INSERT INTO honestfit_marketing_experiments')) {
      state.row ??= makeRow()
      return { rows: [] }
    }

    if (sql.includes('SELECT *')) {
      return { rows: state.row ? [state.row] : [] }
    }

    if (sql.includes('UPDATE honestfit_marketing_experiments')) {
      state.row = makeRow({
        id: params?.[0],
        title: params?.[1],
        hypothesis: params?.[2],
        channel: params?.[3],
        target_url: params?.[4],
        post_draft: params?.[5],
        status: params?.[6],
        post_url: params?.[7],
        posted_at: params?.[8],
        check_after_hours: params?.[9],
        learning_what_happened: params?.[10],
        learning_what_was_confusing: params?.[11],
        next_message_angle: params?.[12],
        updated_at: '2026-05-04T16:00:00.000Z',
      })
      return { rows: [state.row] }
    }

    if (sql.includes('DELETE FROM honestfit_marketing_experiments')) {
      state.row = null
      return { rows: [] }
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

describe('HonestFit marketing experiment persistence', () => {
  beforeEach(() => {
    state.row = null
    fakeClient.query.mockClear()
  })

  it('loads the initial draft experiment', async () => {
    const experiment = await getCurrentHonestFitMarketingExperiment()

    expect(experiment.status).toBe('draft')
    expect(experiment.postUrl).toBeNull()
    expect(experiment.checkAfterHours).toBe(24)
    expect(experiment.targetUrl).toBe('https://honestfit.ai/c/ken-downey')
  })

  it('marks posted and persists url, timestamp, and waiting state', async () => {
    await getCurrentHonestFitMarketingExperiment()

    const experiment = await applyHonestFitMarketingExperimentAction({
      action: 'mark_posted',
      postUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:123',
      postedAt: '2026-05-04T16:00:00.000Z',
    })

    expect(experiment.status).toBe('waiting_for_data')
    expect(experiment.postUrl).toBe(
      'https://www.linkedin.com/feed/update/urn:li:activity:123',
    )
    expect(experiment.postedAt).toBe('2026-05-04T16:00:00.000Z')

    const reloaded = await getCurrentHonestFitMarketingExperiment()
    expect(reloaded.status).toBe('waiting_for_data')
    expect(reloaded.postUrl).toBe(experiment.postUrl)
  })

  it('saves learning and renders the learning_captured state model', async () => {
    state.row = makeRow({
      status: 'waiting_for_data',
      post_url: 'https://www.linkedin.com/feed/update/urn:li:activity:123',
      posted_at: '2026-05-04T16:00:00.000Z',
    })

    const experiment = await applyHonestFitMarketingExperimentAction({
      action: 'save_learning',
      learningWhatHappened: 'Profile clicks but no replies.',
      learningWhatWasConfusing: 'People missed evidence controls.',
      nextMessageAngle: 'Explain public versus private evidence.',
    })

    expect(experiment.status).toBe('learning_captured')
    expect(experiment.learningWhatHappened).toBe('Profile clicks but no replies.')
    expect(experiment.learningWhatWasConfusing).toBe(
      'People missed evidence controls.',
    )
    expect(experiment.nextMessageAngle).toBe(
      'Explain public versus private evidence.',
    )
  })

  it('resets to a new draft experiment', async () => {
    state.row = makeRow({ status: 'learning_captured' })

    const experiment = await applyHonestFitMarketingExperimentAction({
      action: 'reset',
    })

    expect(experiment.status).toBe('draft')
    expect(experiment.postUrl).toBeNull()
    expect(experiment.postedAt).toBeNull()
  })
})
