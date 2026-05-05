import { describe, expect, it } from 'vitest'
import { honestFitMissionSummarySchema } from './honestFitMissionSummary'
import { buildHonestFitOperatorBriefing } from './honestFitOperatorBriefing'

const baseSummary = {
  generatedAt: '2026-04-29T08:00:00Z',
  window: '24h',
  health: {
    status: 'ok',
    blockingIssueCount: 0,
    warningCount: 0,
    appVersion: '0.9.0',
  },
  traffic: {
    pageViews24h: 0,
    topPages24h: [],
    topReferrers24h: [],
  },
  signups: {
    freeTotal: 0,
    free24h: 0,
    proActive: 0,
    pro24h: 0,
    scheduledCancellations: 0,
  },
  funnel: {
    magicLinksRequested24h: 0,
    magicLinksConsumed24h: 0,
    profileViews24h: 0,
    captureStarted24h: 0,
    captureSaved24h: 0,
    fitViewed24h: 0,
    fitReportsRequested24h: 0,
    resumeGenerated24h: 0,
  },
  errors: {
    total24h: 0,
    critical24h: 0,
    recent: [],
  },
  billing: {
    activePro: 0,
    scheduledCancellations: 0,
    stripeWebhookEvents24h: 0,
    stripeWebhookFailures24h: 0,
    lastStripeWebhookAt: null,
  },
}

function summary(overrides: Record<string, unknown> = {}) {
  return honestFitMissionSummarySchema.parse({
    ...baseSummary,
    ...overrides,
    health: {
      ...baseSummary.health,
      ...(overrides.health as Record<string, unknown> | undefined),
    },
    traffic: {
      ...baseSummary.traffic,
      ...(overrides.traffic as Record<string, unknown> | undefined),
    },
    signups: {
      ...baseSummary.signups,
      ...(overrides.signups as Record<string, unknown> | undefined),
    },
    funnel: {
      ...baseSummary.funnel,
      ...(overrides.funnel as Record<string, unknown> | undefined),
    },
    errors: {
      ...baseSummary.errors,
      ...(overrides.errors as Record<string, unknown> | undefined),
    },
    billing: {
      ...baseSummary.billing,
      ...(overrides.billing as Record<string, unknown> | undefined),
    },
  })
}

describe('buildHonestFitOperatorBriefing', () => {
  it('handles no traffic as a clean launch window', () => {
    const briefing = buildHonestFitOperatorBriefing(summary())

    expect(briefing.status).toBe('ok')
    expect(briefing.whatHappened).toContain(
      '0 estimated real page views in the last 24 hours.',
    )
    expect(briefing.whatChanged).toContain(
      'No comparison window yet; watching the next refresh.',
    )
    expect(briefing.whereStuck).toContain('No obvious funnel drop-off yet.')
    expect(briefing.needsAttention).toContain('No urgent action needed.')
  })

  it('watches traffic with no sign-in started', () => {
    const briefing = buildHonestFitOperatorBriefing(
      summary({
        traffic: {
          pageViews24h: 15,
          topPages24h: [{ path: '/pricing', views: 15 }],
        },
      }),
    )

    expect(briefing.status).toBe('watch')
    expect(briefing.whereStuck).toContain(
      'Current launch signal is too low to diagnose conversion. Need more qualified traffic before changing product based on funnel numbers.',
    )
  })

  it('watches sign-in requests that were not consumed', () => {
    const briefing = buildHonestFitOperatorBriefing(
      summary({
        traffic: {
          pageViews24h: 15,
          topPages24h: [{ path: '/pricing', views: 15 }],
        },
        funnel: { magicLinksRequested24h: 2 },
      }),
    )

    expect(briefing.status).toBe('watch')
    expect(briefing.whereStuck).toContain(
      'People requested sign-in links, but no one completed sign-in.',
    )
    expect(briefing.needsAttention).toContain(
      'Check email delivery if sign-in requests continue without completions.',
    )
  })

  it('watches profile reached but capture not started', () => {
    const briefing = buildHonestFitOperatorBriefing(
      summary({
        traffic: {
          pageViews24h: 15,
          topPages24h: [{ path: '/pricing', views: 15 }],
        },
        funnel: {
          magicLinksRequested24h: 2,
          magicLinksConsumed24h: 2,
          profileViews24h: 1,
        },
      }),
    )

    expect(briefing.status).toBe('watch')
    expect(briefing.whereStuck).toContain(
      'Users reached the profile, but no capture was started.',
    )
  })

  it('watches capture started but not saved', () => {
    const briefing = buildHonestFitOperatorBriefing(
      summary({
        traffic: {
          pageViews24h: 15,
          topPages24h: [{ path: '/pricing', views: 15 }],
        },
        funnel: {
          magicLinksRequested24h: 2,
          magicLinksConsumed24h: 2,
          profileViews24h: 1,
          captureStarted24h: 1,
        },
      }),
    )

    expect(briefing.status).toBe('watch')
    expect(briefing.whereStuck).toContain(
      'Capture started, but nothing was saved.',
    )
    expect(briefing.needsAttention).toContain(
      'Review capture flow if saves continue to lag starts.',
    )
  })

  it('escalates health blockers', () => {
    const briefing = buildHonestFitOperatorBriefing(
      summary({
        health: { status: 'blocked', blockingIssueCount: 1 },
      }),
    )

    expect(briefing.status).toBe('needs_attention')
    expect(briefing.needsAttention).toContain('Review health blockers: 1 active.')
  })

  it('escalates Stripe webhook failures', () => {
    const briefing = buildHonestFitOperatorBriefing(
      summary({
        billing: { stripeWebhookEvents24h: 3, stripeWebhookFailures24h: 1 },
      }),
    )

    expect(briefing.status).toBe('needs_attention')
    expect(briefing.needsAttention).toContain(
      'Check Stripe webhook failures: 1 in the last 24 hours.',
    )
  })

  it('keeps a clean active state calm', () => {
    const briefing = buildHonestFitOperatorBriefing(
      summary({
        traffic: {
          pageViews24h: 5,
          topPages24h: [{ path: '/pricing', views: 5 }],
        },
        funnel: {
          magicLinksRequested24h: 1,
          magicLinksConsumed24h: 1,
          profileViews24h: 1,
          captureStarted24h: 1,
          captureSaved24h: 1,
        },
      }),
    )

    expect(briefing.status).toBe('ok')
    expect(briefing.whereStuck).toContain('No obvious funnel drop-off yet.')
    expect(briefing.canIgnore).toContain('No Stripe webhook failures.')
  })

  it('uses future ops.actionItems for attention items', () => {
    const briefing = buildHonestFitOperatorBriefing(
      summary({
        ops: {
          actionItems: [
            {
              title: 'Review recent errors',
              detail: '2 in the last 24 hours.',
            },
          ],
        },
      }),
    )

    expect(briefing.needsAttention).toEqual([
      'Review recent errors: 2 in the last 24 hours.',
    ])
  })

  it('uses future funnelGraph.insight for stuck analysis', () => {
    const briefing = buildHonestFitOperatorBriefing(
      summary({
        funnelGraph: {
          insight: {
            level: 'watch',
            message: 'Users are pausing between profile and capture.',
          },
        },
      }),
    )

    expect(briefing.whereStuck[0]).toBe(
      'Users are pausing between profile and capture.',
    )
  })
})
