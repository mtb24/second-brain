import { describe, expect, it, vi } from 'vitest'
import {
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
})
