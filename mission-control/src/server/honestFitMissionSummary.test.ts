import { describe, expect, it, vi } from 'vitest'
import {
  classifyHonestFitTraffic,
  expectedFeedbackSummary,
  fetchHonestFitMissionSummary,
  honestFitMissionSummarySchema,
} from './honestFitMissionSummary'
import {
  currentProductionSummaryFixture,
  newMainSummaryFixture,
} from '../test-fixtures/honestFitMissionSummary'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchHonestFitMissionSummary', () => {
  it('sends only the server-side bearer token and never appends since', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(currentProductionSummaryFixture))
    const result = await fetchHonestFitMissionSummary({
      env: {
        HONESTFIT_MISSION_SUMMARY_URL:
          'https://honestfit.ai/api/admin/mission/summary',
        HONESTFIT_MISSION_API_SECRET: 'mission-secret',
      },
      fetchImpl,
    })

    expect(result.status).toBe('success')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://honestfit.ai/api/admin/mission/summary',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          Authorization: 'Bearer mission-secret',
          Accept: 'application/json',
        }),
      }),
    )
  })

  it('returns unavailable when Mission env is missing', async () => {
    await expect(
      fetchHonestFitMissionSummary({ env: {}, fetchImpl: vi.fn() }),
    ).resolves.toEqual({
      status: 'unavailable',
      message: 'HonestFit telemetry is not configured.',
    })
  })

  it.each([401, 500])('returns an error result for upstream %i', async (status) => {
    await expect(
      fetchHonestFitMissionSummary({
        env: {
          HONESTFIT_MISSION_SUMMARY_URL:
            'https://honestfit.ai/api/admin/mission/summary',
          HONESTFIT_MISSION_API_SECRET: 'mission-secret',
        },
        fetchImpl: vi.fn(async () => jsonResponse({ error: 'nope' }, status)),
      }),
    ).resolves.toEqual({
      status: 'error',
      message: 'Unable to fetch HonestFit telemetry.',
      upstreamStatus: status,
    })
  })
})

describe('honestFitMissionSummarySchema compatibility', () => {
  it('normalizes the current deployed contract without fabricating feedback availability', () => {
    const parsed = honestFitMissionSummarySchema.parse(
      currentProductionSummaryFixture,
    )

    expect(parsed.contract).toEqual({
      feedback: 'unavailable',
      productEvidence: 'legacy_inferred',
      campaign: 'legacy_normalized',
      incidents: 'available',
    })
    expect(parsed.feedback).toBeNull()
    expect(parsed.productEvidence.evidenceKind).toBe('event_count_only')
    expect(parsed.productEvidence.uniqueUsers).toEqual({
      availability: 'unavailable',
      reason: 'not_instrumented',
    })
    expect(parsed.billing.campaign?.scope).toEqual({
      purchaseRecords: 'lifetime',
      activity: 'rolling_24h',
      state: 'current_state',
    })
    expect(parsed.errors.incidents[0]?.reference).toBe('HF-A1B2')
  })

  it('preserves the new HonestFit contract explicitly', () => {
    const parsed = honestFitMissionSummarySchema.parse(newMainSummaryFixture)

    expect(parsed.contract).toEqual({
      feedback: 'available',
      productEvidence: 'declared',
      campaign: 'declared',
      incidents: 'available',
    })
    expect(parsed.feedback?.items[0]).toEqual(
      expect.objectContaining({
        reference: 'FB-0123456789AB',
        summary: 'Problem report from the Application Kit workspace',
      }),
    )
    expect(parsed.billing.campaign?.customSinceSupported).toBe(false)
    expect(parsed.marketing.scope).toBe('rolling_24h')
  })

  it('keeps the rest of Mission available when feedback is malformed', () => {
    const parsed = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      feedback: { rawMessage: 'private career content' },
    })

    expect(parsed.contract.feedback).toBe('malformed')
    expect(parsed.feedback).toBeNull()
    expect(parsed.health.status).toBe('ok')
    expect(JSON.stringify(parsed)).not.toContain('private career content')
  })

  it('drops feedback whose operator summary is not the controlled phrase', () => {
    const parsed = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      feedback: {
        ...newMainSummaryFixture.feedback,
        items: [
          {
            ...newMainSummaryFixture.feedback.items[0],
            summary: 'Raw text from a user with private details',
          },
        ],
      },
    })

    expect(parsed.contract.feedback).toBe('available')
    expect(parsed.feedback?.items).toEqual([])
    expect(JSON.stringify(parsed)).not.toContain('Raw text')
  })

  it('strips unknown private fields and never preserves legacy raw error messages', () => {
    const parsed = honestFitMissionSummarySchema.parse({
      ...currentProductionSummaryFixture,
      userEmail: 'ken@example.com',
      profileContent: 'private career content',
      errors: {
        ...currentProductionSummaryFixture.errors,
        recent: [
          {
            route: '/fit?email=ken@example.com',
            message: 'Raw exception for ken@example.com',
            stack: 'private stack',
          },
        ],
      },
    })

    const serialized = JSON.stringify(parsed)
    expect(serialized).not.toContain('ken@example.com')
    expect(serialized).not.toContain('private career content')
    expect(serialized).not.toContain('Raw exception')
    expect(serialized).not.toContain('private stack')
    expect(parsed.errors).not.toHaveProperty('recent')
  })

  it('rejects unsafe Sentry destinations without dropping the incident', () => {
    const parsed = honestFitMissionSummarySchema.parse({
      ...currentProductionSummaryFixture,
      errors: {
        ...currentProductionSummaryFixture.errors,
        incidents: [
          {
            ...currentProductionSummaryFixture.errors.incidents[0],
            sentry: {
              eventId: '0123456789abcdef0123456789abcdef',
              url: 'https://example.com/private-payload',
            },
          },
        ],
      },
    })

    expect(parsed.errors.incidents[0]?.reference).toBe('HF-A1B2')
    expect(parsed.errors.incidents[0]?.sentry).toBeNull()
  })

  it('normalizes older warning and blocked health values to degraded', () => {
    for (const status of ['warning', 'blocked'] as const) {
      const parsed = honestFitMissionSummarySchema.parse({
        ...currentProductionSummaryFixture,
        health: { ...currentProductionSummaryFixture.health, status },
      })
      expect(parsed.health.status).toBe('degraded')
    }
  })
})

describe('privacy-safe controlled summaries', () => {
  it('builds only the known feedback summary vocabulary', () => {
    expect(expectedFeedbackSummary('confusing', 'career_memory')).toBe(
      'Usability feedback about Career Memory',
    )
    expect(expectedFeedbackSummary('other', 'unknown')).toBe('General feedback')
  })

  it('classifies real, testing, and ambiguous aggregate traffic', () => {
    expect(
      classifyHonestFitTraffic({
        traffic: {
          pageViews24h: 17,
          topPages24h: [],
          topReferrers24h: [],
        },
        marketing: {
          trafficSources24h: [
            { source: 'linkedin.com', visits: 2 },
            { source: 'internal_smoke', visits: 4 },
            { source: 'production_probe', visits: 3 },
            { source: 'direct', visits: 8 },
          ],
        },
      }),
    ).toEqual({
      raw: 17,
      estimatedReal: 2,
      testingSmokeAdmin: 7,
      ambiguous: 8,
    })
  })
})
