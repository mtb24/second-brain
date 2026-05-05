import { describe, expect, it, vi } from 'vitest'
import {
  classifyHonestFitTraffic,
  fetchHonestFitMissionSummary,
  honestFitMissionSummarySchema,
} from './honestFitMissionSummary'

const validSummary = {
  generatedAt: '2026-04-29T08:00:00Z',
  window: '24h',
  health: {
    status: 'ok',
    blockingIssueCount: 0,
    warningCount: 1,
    appVersion: '0.9.0',
  },
  traffic: {
    pageViews24h: 42,
    topPages24h: [{ path: '/', views: 24 }],
    topReferrers24h: [{ source: 'linkedin.com', views: 12 }],
  },
  signups: {
    freeTotal: 30,
    free24h: 2,
    proActive: 4,
    pro24h: 1,
    scheduledCancellations: 0,
  },
  funnel: {
    magicLinksRequested24h: 8,
    magicLinksConsumed24h: 6,
    profileViews24h: 14,
    captureStarted24h: 5,
    captureSaved24h: 4,
    fitViewed24h: 7,
    fitReportsRequested24h: 3,
    resumeGenerated24h: 2,
  },
  errors: {
    total24h: 1,
    critical24h: 0,
    recent: [
      {
        at: '2026-04-29T07:44:12Z',
        source: 'server',
        route: '/api/fit/reports',
        status: 500,
        message: 'Redacted server error',
        requestId: 'req_123',
      },
    ],
  },
  billing: {
    activePro: 4,
    scheduledCancellations: 0,
    stripeWebhookEvents24h: 10,
    stripeWebhookFailures24h: 0,
    lastStripeWebhookAt: '2026-04-28T18:25:00Z',
  },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchHonestFitMissionSummary', () => {
  it('sends the HonestFit bearer token server-side', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(validSummary))

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

  it('passes a postedAt timestamp to the upstream summary when filtering since publish', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(validSummary))

    await fetchHonestFitMissionSummary({
      env: {
        HONESTFIT_MISSION_SUMMARY_URL:
          'https://honestfit.ai/api/admin/mission/summary',
        HONESTFIT_MISSION_API_SECRET: 'mission-secret',
      },
      fetchImpl,
      since: '2026-05-04T16:00:00.000Z',
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://honestfit.ai/api/admin/mission/summary?since=2026-05-04T16%3A00%3A00.000Z',
      expect.any(Object),
    )
  })

  it('returns unavailable when Mission env is missing', async () => {
    const result = await fetchHonestFitMissionSummary({
      env: {},
      fetchImpl: vi.fn(),
    })

    expect(result).toEqual({
      status: 'unavailable',
      message: 'HonestFit telemetry is not configured.',
    })
  })

  it.each([401, 500])(
    'returns an error result when HonestFit responds %i',
    async (status) => {
      const result = await fetchHonestFitMissionSummary({
        env: {
          HONESTFIT_MISSION_SUMMARY_URL:
            'https://honestfit.ai/api/admin/mission/summary',
          HONESTFIT_MISSION_API_SECRET: 'mission-secret',
        },
        fetchImpl: vi.fn(async () => jsonResponse({ error: 'nope' }, status)),
      })

      expect(result).toEqual({
        status: 'error',
        message: 'Unable to fetch HonestFit telemetry.',
        upstreamStatus: status,
      })
    },
  )

  it('returns an error result for malformed telemetry', async () => {
    const result = await fetchHonestFitMissionSummary({
      env: {
        HONESTFIT_MISSION_SUMMARY_URL:
          'https://honestfit.ai/api/admin/mission/summary',
        HONESTFIT_MISSION_API_SECRET: 'mission-secret',
      },
      fetchImpl: vi.fn(async () => jsonResponse({ generatedAt: 123 })),
    })

    expect(result.status).toBe('error')
  })
})

describe('honestFitMissionSummarySchema', () => {
  it('accepts current HonestFit funnelGraph and ops objects', () => {
    const parsed = honestFitMissionSummarySchema.parse({
      ...validSummary,
      extraFutureField: { shouldBeIgnored: true },
      funnelGraph: {
        window: '24h',
        steps: [
          {
            key: 'magicLinksRequested24h',
            label: 'Sign-in requested',
            count: 2,
            conversionFromPrevious: null,
          },
        ],
        insight: {
          level: 'watch',
          message: 'Sign-in requested, but not consumed.',
        },
        biggestDropoff: {
          from: 'Sign-in requested',
          to: 'Sign-in completed',
          fromCount: 2,
          toCount: 0,
          dropoffPercent: 100,
        },
      },
      ops: {
        launchStatus: 'watch',
        actionItems: [
          {
            level: 'watch',
            title: 'Check email delivery',
            detail: 'Look at delivery for ken@example.com from 203.0.113.5.',
          },
        ],
        signals: {
          healthOk: true,
          errors24h: 0,
        },
      },
    })

    expect(parsed.funnelGraph?.insight).toBe(
      'Sign-in requested, but not consumed.',
    )
    expect(parsed.ops?.actionItems).toEqual([
      'Check email delivery: Look at delivery for [redacted] from [redacted].',
    ])
    expect(JSON.stringify(parsed)).not.toContain('ken@example.com')
    expect(JSON.stringify(parsed)).not.toContain('203.0.113.5')
  })

  it('strips unexpected user fields and redacts obvious email or IP leakage', () => {
    const parsed = honestFitMissionSummarySchema.parse({
      ...validSummary,
      userEmail: 'ken@example.com',
      ip: '203.0.113.5',
      profileContent: 'resume text should not display',
      traffic: {
        ...validSummary.traffic,
        topPages24h: [{ path: '/profile?email=ken@example.com', views: 1 }],
        topReferrers24h: [{ source: '203.0.113.5', views: 1 }],
      },
      errors: {
        ...validSummary.errors,
        recent: [
          {
            at: '2026-04-29T07:44:12Z',
            source: 'server',
            route: '/api/fit?email=ken@example.com',
            status: 500,
            message: 'Failed for ken@example.com at 203.0.113.5',
            requestId: 'req_123',
            rawBody: 'candidate transcript text',
          },
        ],
      },
    })

    expect(JSON.stringify(parsed)).not.toContain('ken@example.com')
    expect(JSON.stringify(parsed)).not.toContain('203.0.113.5')
    expect(JSON.stringify(parsed)).not.toContain('resume text')
    expect(JSON.stringify(parsed)).not.toContain('candidate transcript')
    expect(parsed.traffic.topPages24h[0]?.path).toBe('/profile')
    expect(parsed.errors.recent[0]?.message).toContain('[redacted]')
  })

  it('accepts HonestFit marketing aliases from the upstream summary', () => {
    const parsed = honestFitMissionSummarySchema.parse({
      ...validSummary,
      marketing: {
        visitsBySource24h: [{ source: 'linkedin.com', visits: 8 }],
        visitsByCampaign24h: [{ campaign: 'trust-layer-post', visits: 5 }],
        ctaClicks24h: {
          getStarted: 2,
          signIn: 1,
          viewPlans: 0,
          partnerApiEmail: 0,
        },
      },
    })

    expect(parsed.marketing?.trafficSources24h).toEqual([
      { source: 'linkedin.com', visits: 8 },
    ])
    expect(parsed.marketing?.campaigns24h).toEqual([
      { campaign: 'trust-layer-post', visits: 5 },
    ])
    expect(parsed.marketing?.cta24h.getStartedClicks).toBe(2)
    expect(parsed.marketing?.cta24h.signInClicks).toBe(1)
  })

  it('classifies real, testing, and ambiguous traffic buckets', () => {
    const parsed = honestFitMissionSummarySchema.parse({
      ...validSummary,
      traffic: {
        ...validSummary.traffic,
        pageViews24h: 17,
      },
      marketing: {
        trafficSources24h: [
          { source: 'linkedin.com', visits: 2 },
          { source: 'internal_smoke', visits: 4 },
          { source: 'production_probe', visits: 3 },
          { source: 'direct', visits: 8 },
        ],
      },
    })

    expect(parsed.traffic.classification).toEqual({
      raw: 17,
      estimatedReal: 2,
      testingSmokeAdmin: 7,
      ambiguous: 8,
    })
  })

  it('keeps deploy smoke, public-profile smoke, and Mission checks out of real traffic', () => {
    const classification = classifyHonestFitTraffic({
      traffic: {
        pageViews24h: 12,
        topPages24h: [
          { path: '/api/admin/mission/summary', views: 2 },
          { path: '/c/ken-downey?source=public_profile_smoke', views: 3 },
          { path: '/login?source=deploy_smoke', views: 1 },
          { path: '/', views: 6 },
        ],
        topReferrers24h: [],
      },
    })

    expect(classification).toEqual({
      raw: 12,
      estimatedReal: 0,
      testingSmokeAdmin: 6,
      ambiguous: 6,
    })
  })
})
