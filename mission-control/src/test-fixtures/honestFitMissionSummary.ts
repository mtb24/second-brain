const healthySubsystems = {
  application: { status: 'ok', occurrences24h: 0 },
  authentication: { status: 'ok', occurrences24h: 0 },
  source_processing: { status: 'ok', occurrences24h: 0 },
  billing_entitlement: { status: 'ok', occurrences24h: 0 },
  stripe_webhook: { status: 'ok', occurrences24h: 0 },
  voice: { status: 'ok', occurrences24h: 0 },
  database: { status: 'ok', occurrences24h: 0 },
} as const

export const currentProductionSummaryFixture = {
  generatedAt: '2026-07-17T13:00:00.000Z',
  window: '24h',
  health: {
    status: 'ok',
    blockingIssueCount: 0,
    warningCount: 0,
    appVersion: '1.0.0',
  },
  traffic: {
    pageViews24h: 12,
    topPages24h: [{ path: '/', views: 8 }],
    topReferrers24h: [{ source: 'linkedin.com', views: 4 }],
  },
  signups: {
    freeTotal: 30,
    free24h: 2,
    proActive: 4,
    pro24h: 1,
    scheduledCancellations: 0,
  },
  funnel: {
    magicLinksRequested24h: 3,
    magicLinksConsumed24h: 2,
    profileViews24h: 2,
    captureStarted24h: 1,
    captureSaved24h: 1,
    fitViewed24h: 1,
    fitReportsRequested24h: 1,
    resumeGenerated24h: 0,
  },
  errors: {
    total24h: 1,
    critical24h: 0,
    incidents: [
      {
        reference: 'HF-A1B2',
        sentry: {
          eventId: '0123456789abcdef0123456789abcdef',
          url: 'https://honestfit.sentry.io/issues/?query=id%3A0123456789abcdef0123456789abcdef',
        },
        category: 'source_processing',
        affectedArea: 'source_processing',
        severity: 'warning',
        normalizedRoute: '/api/source/:id',
        buildSha: 'cc954c0dfe6155f70523c4e55534b66e701ed7a9',
        environment: 'production',
        firstSeenAt: '2026-07-17T12:00:00.000Z',
        lastSeenAt: '2026-07-17T12:30:00.000Z',
        occurrenceCount: 2,
        status: 'monitoring',
      },
    ],
    subsystems: healthySubsystems,
  },
  billing: {
    activePro: 4,
    scheduledCancellations: 0,
    stripeWebhookEvents24h: 2,
    stripeWebhookFailures24h: 0,
    lastStripeWebhookAt: '2026-07-17T12:45:00.000Z',
    campaign: {
      purchaseRecords: 3,
      checkoutSessions24h: 1,
      payments24h: 1,
      paymentFailures24h: 0,
      activations24h: 1,
      activationFailures24h: 0,
      active: 2,
      expired: 0,
      refunded: 1,
      disputed: 0,
      manualReview: 0,
    },
  },
  marketing: {
    window: '24h',
    visitsBySource24h: [{ source: 'linkedin.com', visits: 4 }],
    visitsByCampaign24h: [{ campaign: 'campaign-one', visits: 3 }],
    topLandingPages24h: [{ path: '/', views: 8 }],
    topReferrers24h: [{ source: 'linkedin.com', visits: 4 }],
    ctaClicks24h: {
      getStarted: 2,
      signIn: 1,
      viewPlans: 0,
      partnerApiEmail: 0,
    },
  },
  funnelGraph: {
    insight: {
      level: 'info',
      message: 'Aggregate event activity is visible.',
    },
  },
  ops: {
    launchStatus: 'watch',
    actionItems: [{ title: 'Ignored', detail: 'Uncontrolled text is stripped.' }],
  },
}

export const newMainSummaryFixture = {
  ...currentProductionSummaryFixture,
  productEvidence: {
    evidenceKind: 'event_count_only',
    availabilitySemantics: {
      unavailable: 'not_instrumented',
      unsupported: 'not_supported_by_current_contract',
      insufficient_volume: 'instrumented_but_below_minimum_sample',
    },
    eventCounts: {
      availability: 'available',
      zeroSemantics: 'zero_observed_events',
    },
    uniqueUsers: { availability: 'unavailable', reason: 'not_instrumented' },
    cohorts: {
      availability: 'unsupported',
      reason: 'unique_user_evidence_unavailable',
    },
    firstReviewedStory: {
      availability: 'unavailable',
      reason: 'not_instrumented',
    },
    firstApplicationKit: {
      availability: 'unavailable',
      reason: 'not_instrumented',
    },
    practiceEntry: {
      availability: 'unavailable',
      reason: 'not_instrumented',
    },
    returnActivity: {
      availability: 'unavailable',
      reason: 'not_instrumented',
    },
    retention: {
      availability: 'unsupported',
      reason: 'unique_user_evidence_unavailable',
    },
  },
  feedback: {
    authority: 'honestfit_product_feedback',
    privacy: 'sanitized_projection',
    statuses: ['new', 'reviewed', 'closed'],
    query: {
      limit: 25,
      defaultLimit: 25,
      hardLimit: 50,
      statuses: ['new', 'reviewed', 'closed'],
      categories: ['idea', 'problem', 'confusing', 'other'],
      since: null,
      sinceBoundary: 'inclusive',
      sort: 'created_at_desc',
      pagination: 'bounded_no_cursor',
    },
    items: [
      {
        reference: 'FB-0123456789AB',
        category: 'problem',
        createdAt: '2026-07-17T12:55:00.000Z',
        status: 'new',
        unread: true,
        workspace: 'application_kit',
        route: '/fit/:id',
        summary: 'Problem report from the Application Kit workspace',
        optionalContextProvided: true,
      },
    ],
    counts: {
      scope: 'returned_items',
      new: 1,
      reviewed: 0,
      closed: 0,
    },
    hasMore: false,
  },
  billing: {
    ...currentProductionSummaryFixture.billing,
    campaign: {
      ...currentProductionSummaryFixture.billing.campaign,
      scope: {
        purchaseRecords: 'lifetime',
        activity: 'rolling_24h',
        state: 'current_state',
      },
      customSinceSupported: false,
    },
  },
  marketing: {
    ...currentProductionSummaryFixture.marketing,
    scope: 'rolling_24h',
    customSinceSupported: false,
  },
}
