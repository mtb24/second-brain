import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { HonestFitMarketingExperiment } from '@/lib/honestFitMarketingExperiment'
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

function visibleText(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')
}

function experiment(
  patch: Partial<HonestFitMarketingExperiment> = {},
): HonestFitMarketingExperiment {
  return {
    id: 'honestfit-trust-layer-linkedin-v1',
    title: 'Trust Layer public profile LinkedIn post',
    hypothesis: 'Test the Trust Layer message.',
    channel: 'linkedin',
    targetUrl: 'https://honestfit.ai/c/ken-downey',
    postDraft: `Resumes make claims.

I just shipped the first live version of HonestFit's Trust Layer.`,
    status: 'draft',
    postUrl: null,
    postedAt: null,
    checkAfterHours: 24,
    learningWhatHappened: '',
    learningWhatWasConfusing: '',
    nextMessageAngle: '',
    createdAt: '2026-05-04T15:00:00.000Z',
    updatedAt: '2026-05-04T15:00:00.000Z',
    ...patch,
  }
}

describe('HonestFitTelemetryPanelView', () => {
  it('renders core launch telemetry metrics', () => {
    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView result={{ status: 'success', summary }} />,
    )

    expect(html).toContain('HonestFit Launch Telemetry')
    expect(html).toContain('Operator Briefing')
    expect(html).toContain('HonestFit launch status · Last 24 hours')
    expect(html).toContain('What happened')
    expect(html).toContain('What changed')
    expect(html).toContain('Where people got stuck')
    expect(html).toContain('What needs attention')
    expect(html).toContain('What can be ignored')
    expect(html).toContain('HonestFit Launch Funnel')
    expect(html).toContain('HonestFit Marketing Workbench')
    expect(html).toContain('Last 24 hours')
    expect(html).toContain('Site visits')
    expect(html).toContain('Sign-in started')
    expect(html).toContain('Signed in')
    expect(html).toContain('Profile viewed')
    expect(html).toContain('Capture started')
    expect(html).toContain('Capture saved')
    expect(html).toContain('Fit viewed')
    expect(html).toContain('Fit/report action')
    expect(html).toContain('blocked')
    expect(html).toContain('1,234')
    expect(html).toContain('linkedin.com')
    expect(html).toContain('Free total')
    expect(html).toContain('Magic requested')
    expect(html).toContain('/api/fit/reports')
    expect(html).toContain('Webhook failures')
  })

  it('renders the marketing workbench as a publish-ready action panel', () => {
    const marketingSummary = honestFitMissionSummarySchema.parse({
      ...summary,
      traffic: {
        ...summary.traffic,
        topPages24h: [
          { path: '/', views: 9 },
          { path: '/c/ken-downey', views: 25 },
          { path: '/profile/trust', views: 4 },
        ],
      },
      marketing: {
        trafficSources24h: [
          { source: 'linkedin.com', visits: 25 },
          { source: 'direct', visits: 4 },
        ],
        topReferrers24h: [
          { referrer: 'linkedin.com/in/kendowney', visits: 18 },
        ],
        campaigns24h: [{ campaign: 'launch-post', visits: 20 }],
        cta24h: {
          getStartedClicks: 7,
          signInClicks: 3,
          viewPlansClicks: 2,
          partnerApiEmailClicks: 1,
        },
      },
    })

    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{ status: 'success', summary: marketingSummary }}
      />,
    )

    expect(html).toContain('HonestFit Marketing Workbench')
    expect(html).toContain('Current diagnosis')
    expect(html).toContain(
      'Not enough qualified traffic to diagnose signup conversion yet.',
    )
    expect(html).toContain('Next action')
    expect(html).toContain('Publish this post today')
    expect(html).toContain('Why')
    expect(html).toContain(
      'The product is live enough to test the message.',
    )
    expect(html).toContain('https://honestfit.ai/c/ken-downey')
    expect(html).toContain('Publish-ready LinkedIn post')
    expect(html).toContain('Resumes make claims.')
    expect(html).toContain(
      'I just shipped the first live version of HonestFit',
    )
    expect(html).toContain('Alternate hooks')
    expect(html).toContain(
      'A resume is a list of claims. I&#x27;m building a way to show what supports them.',
    )
    expect(html).toContain(
      'I don&#x27;t think AI resume tools are enough. The harder problem is trust.',
    )
    expect(html).toContain('Use this screenshot')
    expect(html).toContain('Screenshot the first fold of /c/ken-downey')
    expect(html).toContain('Include the Trust claims/evidence section')
    expect(html).toContain('Avoid screenshots of internal dashboards')
    expect(html).toContain('Ask for this feedback')
    expect(html).toContain(
      'Without me explaining it, what do you think this page is for?',
    )
    expect(html).toContain('Does the Trust &amp; Evidence section make sense?')
    expect(html).toContain('Would this tell you more than a resume?')
    expect(html).toContain('Check tomorrow')
    expect(html).toContain('Comments/replies')
    expect(html).toContain('What people misunderstood')
    expect(html).toContain('Learning log')
    expect(html).toContain('Posted URL')
    expect(html).toContain('Mark posted')
    expect(html).toContain('What happened?')
    expect(html).toContain('What was confusing?')
    expect(html).toContain('Next message angle')
    expect(html).toContain('Supporting metrics')
    expect(html).toContain('Public profile visits')
    expect(html).toContain('Homepage visits')
    expect(html).toContain('CTA clicks')
    expect(html).toContain('Sign-in attempts')
    expect(html).toContain('4xx/5xx errors')
    expect(html).toContain('Campaigns')
    expect(html).toContain('launch-post')
    expect(html).toContain('linkedin.com: 25')

    expect(html.indexOf('Supporting metrics')).toBeGreaterThan(
      html.indexOf('Publish-ready LinkedIn post'),
    )
  })

  it('renders an empty traffic state when attribution has no activity', () => {
    const emptyMarketingSummary = honestFitMissionSummarySchema.parse({
      ...summary,
      traffic: {
        ...summary.traffic,
        pageViews24h: 0,
        topPages24h: [],
        topReferrers24h: [],
      },
      funnel: {
        ...summary.funnel,
        magicLinksRequested24h: 0,
        magicLinksConsumed24h: 0,
      },
      errors: {
        ...summary.errors,
        total24h: 0,
        critical24h: 0,
        recent: [],
      },
      marketing: {
        trafficSources24h: [],
        topReferrers24h: [],
        campaigns24h: [],
        cta24h: {
          getStartedClicks: 0,
          signInClicks: 0,
          viewPlansClicks: 0,
          partnerApiEmailClicks: 0,
        },
      },
    })

    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{ status: 'success', summary: emptyMarketingSummary }}
      />,
    )

    expect(html).toContain('No useful signal yet.')
    expect(html).toContain(
      'Publish the post before changing the product.',
    )
    expect(html).toContain(
      'Not enough qualified traffic to diagnose signup conversion yet.',
    )
    expect(html).toContain('No CTA signal yet')
  })

  it('keeps metrics as supporting evidence when there is traffic but no CTA signal', () => {
    const zeroSignupSummary = honestFitMissionSummarySchema.parse({
      ...summary,
      signups: {
        ...summary.signups,
        free24h: 0,
        pro24h: 0,
      },
      marketing: {
        trafficSources24h: [{ source: 'direct', visits: 15 }],
        topReferrers24h: [],
        campaigns24h: [],
        cta24h: {
          getStartedClicks: 0,
          signInClicks: 0,
          viewPlansClicks: 0,
          partnerApiEmailClicks: 0,
        },
      },
    })

    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{ status: 'success', summary: zeroSignupSummary }}
      />,
    )

    expect(html).toContain('Supporting metrics')
    expect(html).toContain('direct: 15')
    expect(html).toContain('No CTA signal yet')
  })

  it('renders the LinkedIn top-source recommendation', () => {
    const linkedinSummary = honestFitMissionSummarySchema.parse({
      ...summary,
      marketing: {
        trafficSources24h: [
          { source: 'linkedin.com', visits: 30 },
          { source: 'direct', visits: 3 },
        ],
        topReferrers24h: [],
        campaigns24h: [],
        cta24h: {
          getStartedClicks: 0,
          signInClicks: 0,
          viewPlansClicks: 0,
          partnerApiEmailClicks: 0,
        },
      },
    })

    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{ status: 'success', summary: linkedinSummary }}
      />,
    )

    expect(html).toContain('linkedin.com: 30')
    expect(html).toContain('Publish this post today')
  })

  it('renders persisted waiting_for_data state after a posted experiment reload', () => {
    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{ status: 'success', summary }}
        experiment={experiment({
          status: 'waiting_for_data',
          postUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:123',
          postedAt: '2026-05-04T16:00:00.000Z',
        })}
      />,
    )

    expect(html).toContain('Waiting for data')
    expect(html).toContain('Check metrics after 24h')
    expect(html).toContain(
      'https://www.linkedin.com/feed/update/urn:li:activity:123',
    )
    expect(html).toContain('Posted')
    expect(html).toContain('Check after')
    expect(html).toContain('Since posted')
    expect(html).toContain('Supporting metrics')
  })

  it('renders persisted learning fields and learning_captured state', () => {
    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{ status: 'success', summary }}
        experiment={experiment({
          status: 'learning_captured',
          postUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:123',
          postedAt: '2026-05-04T16:00:00.000Z',
          learningWhatHappened: 'Profile clicks, but no replies.',
          learningWhatWasConfusing: 'People missed evidence controls.',
          nextMessageAngle: 'Explain public versus private evidence.',
        })}
      />,
    )

    expect(html).toContain('Learning captured')
    expect(html).toContain('Profile clicks, but no replies.')
    expect(html).toContain('People missed evidence controls.')
    expect(html).toContain('Explain public versus private evidence.')
    expect(html).toContain('Next-message recommendation')
  })

  it('renders CTA clicks and sign-in attempts below the action panel', () => {
    const ctaNoSignupSummary = honestFitMissionSummarySchema.parse({
      ...summary,
      funnel: {
        ...summary.funnel,
        magicLinksRequested24h: 0,
        magicLinksConsumed24h: 0,
      },
      signups: {
        ...summary.signups,
        free24h: 0,
        pro24h: 0,
      },
      marketing: {
        trafficSources24h: [{ source: 'launch-post', visits: 11 }],
        topReferrers24h: [],
        campaigns24h: [{ campaign: 'launch-post', visits: 11 }],
        cta24h: {
          getStartedClicks: 4,
          signInClicks: 0,
          viewPlansClicks: 0,
          partnerApiEmailClicks: 0,
        },
      },
    })

    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{ status: 'success', summary: ctaNoSignupSummary }}
      />,
    )

    expect(html).toContain('CTA clicks')
    expect(html).toContain('Sign-in attempts')
    expect(html).toContain('4')
    expect(html.indexOf('Supporting metrics')).toBeGreaterThan(
      html.indexOf('Check tomorrow'),
    )
  })

  it('renders funnel conversions from the previous step', () => {
    const conversionSummary = honestFitMissionSummarySchema.parse({
      ...summary,
      traffic: {
        ...summary.traffic,
        pageViews24h: 20,
      },
      funnel: {
        ...summary.funnel,
        magicLinksRequested24h: 10,
        magicLinksConsumed24h: 8,
        profileViews24h: 4,
        captureStarted24h: 4,
        captureSaved24h: 2,
        fitViewed24h: 2,
        fitReportsRequested24h: 1,
        resumeGenerated24h: 1,
      },
    })

    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{ status: 'success', summary: conversionSummary }}
      />,
    )
    const text = visibleText(html)

    expect(text).toContain('10 sign-in started')
    expect(text).toContain('50% from site visits')
    expect(text).toContain('8 signed in')
    expect(text).toContain('80% from sign-in started')
    expect(text).toContain('2 fit/report action')
    expect(text).toContain('100% from fit viewed')
  })

  it('renders a dash when the previous funnel step is zero', () => {
    const zeroPreviousSummary = honestFitMissionSummarySchema.parse({
      ...summary,
      traffic: {
        ...summary.traffic,
        pageViews24h: 0,
      },
      funnel: {
        ...summary.funnel,
        magicLinksRequested24h: 2,
        magicLinksConsumed24h: 1,
        profileViews24h: 1,
        captureStarted24h: 0,
        captureSaved24h: 0,
        fitViewed24h: 0,
        fitReportsRequested24h: 0,
        resumeGenerated24h: 0,
      },
    })

    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{ status: 'success', summary: zeroPreviousSummary }}
      />,
    )
    const text = visibleText(html)

    expect(text).toContain('0 site visits')
    expect(text).toContain('2 sign-in started')
    expect(text).toContain('—')
  })

  it('renders the biggest drop-off funnel insight', () => {
    const dropOffSummary = honestFitMissionSummarySchema.parse({
      ...summary,
      traffic: {
        ...summary.traffic,
        pageViews24h: 10,
      },
      funnel: {
        ...summary.funnel,
        magicLinksRequested24h: 10,
        magicLinksConsumed24h: 3,
        profileViews24h: 3,
        captureStarted24h: 3,
        captureSaved24h: 3,
        fitViewed24h: 3,
        fitReportsRequested24h: 2,
        resumeGenerated24h: 1,
      },
    })

    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{ status: 'success', summary: dropOffSummary }}
      />,
    )

    expect(html).toContain('Biggest drop-off: Sign-in started -&gt; Signed in')
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
      marketing: {
        trafficSources24h: [
          {
            source: 'linkedin.com?email=ken@example.com',
            visits: 1,
            userId: 'user_123',
          },
        ],
        topReferrers24h: [
          {
            referrer: 'https://example.com/path?ip=203.0.113.5',
            visits: 1,
            profileId: 'profile_123',
          },
        ],
        campaigns24h: [
          {
            campaign: 'privacy-test',
            visits: 1,
            secret: 'mission-secret',
            content: 'raw profile content',
          },
        ],
        cta24h: {
          getStartedClicks: 1,
          signInClicks: 0,
          viewPlansClicks: 0,
          partnerApiEmailClicks: 0,
        },
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
    expect(html).not.toContain('user_123')
    expect(html).not.toContain('profile_123')
    expect(html).not.toContain('raw profile content')
  })

  it('uses future briefing fields without rendering private action text', () => {
    const futureSummary = honestFitMissionSummarySchema.parse({
      ...summary,
      funnelGraph: {
        insight: {
          level: 'watch',
          message: 'Sign-in requested, but not consumed.',
        },
      },
      ops: {
        actionItems: [
          {
            level: 'watch',
            title: 'Check email delivery',
            detail: 'Check delivery for ken@example.com from 203.0.113.5.',
          },
        ],
      },
    })

    const html = renderToStaticMarkup(
      <HonestFitTelemetryPanelView
        result={{ status: 'success', summary: futureSummary }}
      />,
    )

    expect(html).toContain('Sign-in requested, but not consumed.')
    expect(html).toContain(
      'Check email delivery: Check delivery for [redacted] from [redacted].',
    )
    expect(html).not.toContain('ken@example.com')
    expect(html).not.toContain('203.0.113.5')
  })
})
