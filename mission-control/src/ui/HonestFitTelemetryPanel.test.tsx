import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { honestFitMissionSummarySchema } from '@/server/honestFitMissionSummary'
import { HonestFitTelemetryPanelView } from './HonestFitTelemetryPanel'

const summary = honestFitMissionSummarySchema.parse({
  generatedAt: '2026-04-29T08:00:00Z',
  window: '24h',
  health: {
    status: 'blocked',
    blockingIssueCount: 1,
    warningCount: 2,
    appVersion: '0.9.0',
  },
  traffic: {
    pageViews24h: 1234,
    topPages24h: [{ path: '/', views: 900 }],
    topReferrers24h: [{ source: 'linkedin.com', views: 123 }],
  },
  signups: {
    freeTotal: 50,
    free24h: 5,
    proActive: 7,
    pro24h: 2,
    scheduledCancellations: 1,
  },
  funnel: {
    magicLinksRequested24h: 10,
    magicLinksConsumed24h: 8,
    profileViews24h: 15,
    captureStarted24h: 6,
    captureSaved24h: 4,
    fitViewed24h: 9,
    fitReportsRequested24h: 3,
    resumeGenerated24h: 2,
  },
  errors: {
    total24h: 3,
    critical24h: 1,
    recent: [
      {
        at: '2026-04-29T07:44:12Z',
        source: 'server',
        route: '/api/fit/reports',
        status: 500,
        message: 'Redacted server error',
        requestId: 'req_abc',
      },
    ],
  },
  billing: {
    activePro: 7,
    scheduledCancellations: 1,
    stripeWebhookEvents24h: 18,
    stripeWebhookFailures24h: 1,
    lastStripeWebhookAt: '2026-04-28T18:25:00Z',
  },
})

describe('HonestFitTelemetryPanelView', () => {
  it('renders core launch telemetry metrics', () => {
    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView result={{ status: 'success', summary }} />,
    )

    expect(html).toContain('HonestFit Launch Telemetry')
    expect(html).toContain('blocked')
    expect(html).toContain('1,234')
    expect(html).toContain('linkedin.com')
    expect(html).toContain('Free total')
    expect(html).toContain('Magic requested')
    expect(html).toContain('/api/fit/reports')
    expect(html).toContain('Webhook failures')
  })

  it('renders unavailable and upstream error states', () => {
    const unavailable = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{
          status: 'unavailable',
          message: 'HonestFit telemetry is not configured.',
        }}
      />,
    )
    const error = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{
          status: 'error',
          message: 'Unable to fetch HonestFit telemetry.',
          upstreamStatus: 401,
        }}
      />,
    )

    expect(unavailable).toContain('Unavailable')
    expect(error).toContain('Unable to fetch HonestFit telemetry')
    expect(error).toContain('401')
  })

  it('does not render secrets, emails, IPs, or content fields', () => {
    const redactedSummary = honestFitMissionSummarySchema.parse({
      ...summary,
      secret: 'mission-secret',
      email: 'ken@example.com',
      ip: '203.0.113.5',
      transcript: 'long transcript content',
      traffic: {
        ...summary.traffic,
        topPages24h: [{ path: '/profile?email=ken@example.com', views: 1 }],
      },
      errors: {
        ...summary.errors,
        recent: [
          {
            at: '2026-04-29T07:44:12Z',
            source: 'server',
            route: '/api/resume?ip=203.0.113.5',
            status: 500,
            message: 'Redacted failure for ken@example.com from 203.0.113.5',
            requestId: 'req_safe',
            body: 'raw JD content',
          },
        ],
      },
    })

    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{ status: 'success', summary: redactedSummary }}
      />,
    )

    expect(html).not.toContain('mission-secret')
    expect(html).not.toContain('ken@example.com')
    expect(html).not.toContain('203.0.113.5')
    expect(html).not.toContain('long transcript content')
    expect(html).not.toContain('raw JD content')
  })
})
