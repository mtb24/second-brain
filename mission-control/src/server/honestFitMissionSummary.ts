import { z } from 'zod'

const INCIDENT_CATEGORIES = [
  'application',
  'authentication',
  'source_processing',
  'billing_entitlement',
  'stripe_webhook',
  'voice',
  'database',
] as const

const FEEDBACK_CATEGORIES = ['idea', 'problem', 'confusing', 'other'] as const
const FEEDBACK_STATUSES = ['new', 'reviewed', 'closed'] as const
const FEEDBACK_WORKSPACES = [
  'career_memory',
  'application_kit',
  'practice',
  'story_inbox',
  'story_capture',
  'account',
  'settings',
  'profile',
  'public_profile',
  'other',
  'unknown',
] as const

const numberMetric = z.number().finite().nonnegative()
const integerMetric = z.number().int().finite().nonnegative()
const defaultNumberMetric = numberMetric.catch(0)
const optionalDateString = z.string().datetime().nullable().catch(null)

function redactPrivateText(value: string): string {
  return value
    .split(/[?#]/)[0]
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted]')
    .slice(0, 240)
}

const displayString = z.string().transform(redactPrivateText)
const optionalDisplayString = z.string().transform(redactPrivateText).optional()

function normalizedRoute(value: string): string {
  const route = redactPrivateText(value)
  if (!route.startsWith('/')) return '/unknown'
  return route.slice(0, 240)
}

const routeString = z.string().transform(normalizedRoute)
const buildSha = z
  .string()
  .regex(/^[0-9a-f]{7,64}$/i)
  .nullable()
  .catch(null)

function controlledToken(value: string): string {
  return /^[a-z0-9_:-]+$/i.test(value) ? value.slice(0, 120) : 'unknown'
}

const controlledString = z.string().transform(controlledToken)

function safeSentryUrl(value: string): string | null {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    const sentryHost =
      host === 'sentry.io' ||
      host.endsWith('.sentry.io') ||
      host === 'sentry.com' ||
      host.endsWith('.sentry.com')
    return url.protocol === 'https:' && sentryHost ? url.toString() : null
  } catch {
    return null
  }
}

function logHonestFitTelemetryIssue(
  reason: string,
  details: Record<string, unknown> = {},
) {
  console.warn('[honestfit-mission-summary]', { reason, ...details })
}

const rankedMetricSchema = z.object({
  path: routeString.optional(),
  source: optionalDisplayString,
  views: defaultNumberMetric,
})

const marketingRankedMetricSchema = z.object({
  source: optionalDisplayString,
  referrer: optionalDisplayString,
  campaign: optionalDisplayString,
  visits: defaultNumberMetric,
})

const trafficClassificationSchema = z.object({
  raw: defaultNumberMetric,
  estimatedReal: defaultNumberMetric,
  testingSmokeAdmin: defaultNumberMetric,
  ambiguous: defaultNumberMetric,
})

const subsystemSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  occurrences24h: defaultNumberMetric,
})

const subsystemMapSchema = z.object({
  application: subsystemSchema,
  authentication: subsystemSchema,
  source_processing: subsystemSchema,
  billing_entitlement: subsystemSchema,
  stripe_webhook: subsystemSchema,
  voice: subsystemSchema,
  database: subsystemSchema,
})

const incidentSentrySchema = z
  .object({
    eventId: z.string().regex(/^[0-9a-f]{32}$/),
    url: z.string(),
  })
  .transform((sentry) => {
    const url = safeSentryUrl(sentry.url)
    return url ? { eventId: sentry.eventId, url } : null
  })
  .nullable()
  .catch(null)

const incidentSchema = z.object({
  reference: z.string().regex(/^HF-[0-9A-F]{4}$/),
  sentry: incidentSentrySchema,
  category: z.enum(INCIDENT_CATEGORIES),
  affectedArea: controlledString,
  severity: z.enum(['warning', 'error', 'critical']),
  normalizedRoute: routeString,
  buildSha,
  environment: controlledString,
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  occurrenceCount: integerMetric,
  status: z.enum(['open', 'monitoring', 'resolved']),
})

const evidenceAvailabilitySchema = z.discriminatedUnion('availability', [
  z.object({
    availability: z.literal('available'),
    zeroSemantics: z.literal('zero_observed_events'),
  }),
  z.object({
    availability: z.literal('unavailable'),
    reason: z.literal('not_instrumented'),
  }),
  z.object({
    availability: z.literal('unsupported'),
    reason: z.literal('unique_user_evidence_unavailable'),
  }),
  z.object({
    availability: z.literal('insufficient_volume'),
    reason: z.literal('below_minimum_sample'),
  }),
])

const productEvidenceSchema = z.object({
  evidenceKind: z.literal('event_count_only'),
  availabilitySemantics: z.object({
    unavailable: z.literal('not_instrumented'),
    unsupported: z.literal('not_supported_by_current_contract'),
    insufficient_volume: z.literal('instrumented_but_below_minimum_sample'),
  }),
  eventCounts: evidenceAvailabilitySchema,
  uniqueUsers: evidenceAvailabilitySchema,
  cohorts: evidenceAvailabilitySchema,
  firstReviewedStory: evidenceAvailabilitySchema,
  firstApplicationKit: evidenceAvailabilitySchema,
  practiceEntry: evidenceAvailabilitySchema,
  returnActivity: evidenceAvailabilitySchema,
  retention: evidenceAvailabilitySchema,
})

const legacyProductEvidence = productEvidenceSchema.parse({
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
})

type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]
type FeedbackWorkspace = (typeof FEEDBACK_WORKSPACES)[number]

const feedbackWorkspaceLabels: Partial<Record<FeedbackWorkspace, string>> = {
  career_memory: 'Career Memory',
  application_kit: 'the Application Kit workspace',
  practice: 'Practice',
  story_inbox: 'Story Inbox',
  story_capture: 'story capture',
  account: 'the account area',
  settings: 'Settings',
  profile: 'the profile workspace',
  public_profile: 'the public-profile workspace',
}

export function expectedFeedbackSummary(
  category: FeedbackCategory,
  workspace: FeedbackWorkspace,
): string {
  const label = feedbackWorkspaceLabels[workspace]
  if (category === 'idea') return label ? `Product idea about ${label}` : 'Product idea'
  if (category === 'problem') {
    return label ? `Problem report from ${label}` : 'Problem report'
  }
  if (category === 'confusing') {
    return label ? `Usability feedback about ${label}` : 'Usability feedback'
  }
  return label ? `General feedback from ${label}` : 'General feedback'
}

const feedbackItemInputSchema = z.object({
  reference: z.string().regex(/^FB-[0-9A-F]{12}$/),
  category: z.enum(FEEDBACK_CATEGORIES),
  createdAt: z.string().datetime(),
  status: z.enum(FEEDBACK_STATUSES),
  unread: z.boolean(),
  workspace: z.enum(FEEDBACK_WORKSPACES),
  route: routeString.nullable(),
  summary: z.string().max(240),
  optionalContextProvided: z.boolean(),
})

const feedbackItemsSchema = z.array(z.unknown()).transform((items) =>
  items.flatMap((item) => {
    const parsed = feedbackItemInputSchema.safeParse(item)
    if (!parsed.success) return []
    const expectedSummary = expectedFeedbackSummary(
      parsed.data.category,
      parsed.data.workspace,
    )
    if (parsed.data.summary !== expectedSummary) return []
    return [{ ...parsed.data, summary: expectedSummary }]
  }),
)

const feedbackProjectionSchema = z.object({
  authority: z.literal('honestfit_product_feedback'),
  privacy: z.literal('sanitized_projection'),
  statuses: z.array(z.enum(FEEDBACK_STATUSES)),
  query: z.object({
    limit: z.number().int().min(1).max(50),
    defaultLimit: z.literal(25),
    hardLimit: z.literal(50),
    statuses: z.array(z.enum(FEEDBACK_STATUSES)),
    categories: z.array(z.enum(FEEDBACK_CATEGORIES)),
    since: z.string().datetime().nullable(),
    sinceBoundary: z.literal('inclusive'),
    sort: z.literal('created_at_desc'),
    pagination: z.literal('bounded_no_cursor'),
  }),
  items: feedbackItemsSchema,
  counts: z.object({
    scope: z.literal('returned_items'),
    new: integerMetric,
    reviewed: integerMetric,
    closed: integerMetric,
  }),
  hasMore: z.boolean(),
})

const campaignMetricsSchema = z.object({
  scope: z
    .object({
      purchaseRecords: z.literal('lifetime'),
      activity: z.literal('rolling_24h'),
      state: z.literal('current_state'),
    })
    .optional(),
  customSinceSupported: z.literal(false).optional(),
  purchaseRecords: integerMetric,
  checkoutSessions24h: integerMetric,
  payments24h: integerMetric,
  paymentFailures24h: integerMetric,
  activations24h: integerMetric,
  activationFailures24h: integerMetric,
  active: integerMetric,
  expired: integerMetric,
  refunded: integerMetric,
  disputed: integerMetric,
  manualReview: integerMetric,
})

const marketingSchema = z.preprocess(
  normalizeMarketingSummary,
  z.object({
    window: z.literal('24h').catch('24h'),
    scope: z.literal('rolling_24h').optional(),
    customSinceSupported: z.literal(false).optional(),
    trafficSources24h: z.array(marketingRankedMetricSchema).catch([]),
    topReferrers24h: z.array(marketingRankedMetricSchema).catch([]),
    campaigns24h: z.array(marketingRankedMetricSchema).catch([]),
    cta24h: z
      .object({
        getStartedClicks: defaultNumberMetric,
        signInClicks: defaultNumberMetric,
        viewPlansClicks: defaultNumberMetric,
        partnerApiEmailClicks: defaultNumberMetric,
      })
      .catch({
        getStartedClicks: 0,
        signInClicks: 0,
        viewPlansClicks: 0,
        partnerApiEmailClicks: 0,
      }),
  }),
)

const emptyMarketingSummary = {
  window: '24h' as const,
  trafficSources24h: [],
  topReferrers24h: [],
  campaigns24h: [],
  cta24h: {
    getStartedClicks: 0,
    signInClicks: 0,
    viewPlansClicks: 0,
    partnerApiEmailClicks: 0,
  },
}

const previousWindowSchema = z
  .object({
    traffic: z.object({ pageViews24h: numberMetric.optional() }).optional(),
    signups: z.object({ pro24h: numberMetric.optional() }).optional(),
    errors: z
      .object({
        total24h: numberMetric.optional(),
        critical24h: numberMetric.optional(),
      })
      .optional(),
    billing: z
      .object({
        stripeWebhookEvents24h: numberMetric.optional(),
        stripeWebhookFailures24h: numberMetric.optional(),
      })
      .optional(),
  })
  .optional()

const rawSummarySchema = z.object({
  generatedAt: z.string().datetime(),
  window: z.literal('24h').catch('24h'),
  health: z.object({
    status: z.enum(['ok', 'degraded', 'warning', 'blocked']),
    blockingIssueCount: defaultNumberMetric,
    warningCount: defaultNumberMetric,
    appVersion: displayString.optional(),
  }),
  traffic: z.object({
    pageViews24h: defaultNumberMetric,
    topPages24h: z.array(rankedMetricSchema).catch([]),
    topReferrers24h: z.array(rankedMetricSchema).catch([]),
    classification: trafficClassificationSchema.optional(),
  }),
  signups: z.object({
    freeTotal: defaultNumberMetric,
    free24h: defaultNumberMetric,
    proActive: defaultNumberMetric,
    pro24h: defaultNumberMetric,
    scheduledCancellations: defaultNumberMetric,
  }),
  funnel: z.object({
    magicLinksRequested24h: defaultNumberMetric,
    magicLinksConsumed24h: defaultNumberMetric,
    profileViews24h: defaultNumberMetric,
    captureStarted24h: defaultNumberMetric,
    captureSaved24h: defaultNumberMetric,
    fitViewed24h: defaultNumberMetric,
    fitReportsRequested24h: defaultNumberMetric,
    resumeGenerated24h: defaultNumberMetric,
  }),
  productEvidence: z.unknown().optional(),
  feedback: z.unknown().optional(),
  errors: z.object({
    total24h: defaultNumberMetric,
    critical24h: defaultNumberMetric,
    incidents: z.array(incidentSchema).optional(),
    subsystems: z.unknown().optional(),
  }),
  billing: z.object({
    activePro: defaultNumberMetric,
    scheduledCancellations: defaultNumberMetric,
    stripeWebhookEvents24h: defaultNumberMetric,
    stripeWebhookFailures24h: defaultNumberMetric,
    lastStripeWebhookAt: optionalDateString,
    campaign: z.unknown().optional(),
  }),
  marketing: marketingSchema.optional(),
  previous: previousWindowSchema,
  funnelGraph: z
    .object({
      insight: z
        .object({ message: displayString })
        .transform((insight) => insight.message)
        .or(displayString)
        .optional(),
    })
    .optional(),
  ops: z
    .object({
      launchStatus: z.enum(['ok', 'watch', 'needs_attention']).optional(),
      resendAlerts24h: defaultNumberMetric.optional(),
    })
    .optional(),
})

export const honestFitMissionSummarySchema = rawSummarySchema.transform((raw) => {
  const feedbackResult = feedbackProjectionSchema.safeParse(raw.feedback)
  const evidenceResult = productEvidenceSchema.safeParse(raw.productEvidence)
  const campaignResult = campaignMetricsSchema.safeParse(raw.billing.campaign)
  const subsystemResult = subsystemMapSchema.safeParse(raw.errors.subsystems)
  const status = raw.health.status === 'ok' ? 'ok' : 'degraded'
  const marketing = raw.marketing ?? emptyMarketingSummary
  const traffic = {
    ...raw.traffic,
    classification: currentTrafficClassification({
      traffic: raw.traffic,
      marketing,
    }),
  }

  return {
    generatedAt: raw.generatedAt,
    window: raw.window,
    contract: {
      feedback:
        raw.feedback === undefined
          ? ('unavailable' as const)
          : feedbackResult.success
            ? ('available' as const)
            : ('malformed' as const),
      productEvidence:
        raw.productEvidence === undefined
          ? ('legacy_inferred' as const)
          : evidenceResult.success
            ? ('declared' as const)
            : ('malformed' as const),
      campaign:
        raw.billing.campaign === undefined
          ? ('unavailable' as const)
          : campaignResult.success
            ? campaignResult.data.scope
              ? ('declared' as const)
              : ('legacy_normalized' as const)
            : ('malformed' as const),
      incidents:
        raw.errors.incidents === undefined || raw.errors.subsystems === undefined
          ? ('unavailable' as const)
          : subsystemResult.success
            ? ('available' as const)
            : ('malformed' as const),
    },
    health: { ...raw.health, status },
    traffic,
    signups: raw.signups,
    funnel: raw.funnel,
    productEvidence: evidenceResult.success
      ? evidenceResult.data
      : legacyProductEvidence,
    feedback: feedbackResult.success ? feedbackResult.data : null,
    errors: {
      total24h: raw.errors.total24h,
      critical24h: raw.errors.critical24h,
      incidents: raw.errors.incidents ?? [],
      subsystems: subsystemResult.success ? subsystemResult.data : null,
    },
    billing: {
      activePro: raw.billing.activePro,
      scheduledCancellations: raw.billing.scheduledCancellations,
      stripeWebhookEvents24h: raw.billing.stripeWebhookEvents24h,
      stripeWebhookFailures24h: raw.billing.stripeWebhookFailures24h,
      lastStripeWebhookAt: raw.billing.lastStripeWebhookAt,
      campaign: campaignResult.success
        ? {
            ...campaignResult.data,
            scope: {
              purchaseRecords: 'lifetime' as const,
              activity: 'rolling_24h' as const,
              state: 'current_state' as const,
            },
            customSinceSupported: false as const,
          }
        : null,
    },
    marketing: {
      ...marketing,
      scope: 'rolling_24h' as const,
      customSinceSupported: false as const,
    },
    previous: raw.previous,
    funnelGraph: raw.funnelGraph,
    ops: raw.ops,
  }
})

export type HonestFitMissionSummary = z.infer<typeof honestFitMissionSummarySchema>
export type HonestFitIncidentCategory = (typeof INCIDENT_CATEGORIES)[number]
export type HonestFitFeedback = z.infer<typeof feedbackProjectionSchema>
export type HonestFitFeedbackItem = HonestFitFeedback['items'][number]

export type HonestFitMissionSummaryResult =
  | { status: 'success'; summary: HonestFitMissionSummary }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string; upstreamStatus?: number }

type FetchSummaryOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
}

type TrafficClassificationInput = {
  traffic: {
    pageViews24h: number
    topPages24h: { path?: string; source?: string; views: number }[]
    topReferrers24h: { path?: string; source?: string; views: number }[]
  }
  marketing?: {
    trafficSources24h: {
      source?: string
      referrer?: string
      campaign?: string
      visits: number
    }[]
  }
}

export function classifyHonestFitTraffic(
  summary: TrafficClassificationInput,
): z.infer<typeof trafficClassificationSchema> {
  const raw = summary.traffic.pageViews24h
  const sources = summary.marketing?.trafficSources24h ?? []

  if (sources.length > 0) {
    const classified = sources.reduce(
      (totals, item) => {
        const label = trafficLabel(item)
        if (isTestingSmokeAdminTraffic(label)) totals.testingSmokeAdmin += item.visits
        else if (isAmbiguousDirectTraffic(label)) totals.ambiguous += item.visits
        else totals.estimatedReal += item.visits
        return totals
      },
      { estimatedReal: 0, testingSmokeAdmin: 0, ambiguous: 0 },
    )
    const total =
      classified.estimatedReal + classified.testingSmokeAdmin + classified.ambiguous
    if (total < raw) classified.ambiguous += raw - total
    return normalizeTrafficClassification(raw, classified)
  }

  const classified = summary.traffic.topPages24h.reduce(
    (totals, item) => {
      const label = trafficLabel(item)
      if (isTestingSmokeAdminTraffic(label)) totals.testingSmokeAdmin += item.views
      else if (isAmbiguousProductPage(label)) totals.ambiguous += item.views
      else totals.estimatedReal += item.views
      return totals
    },
    { estimatedReal: 0, testingSmokeAdmin: 0, ambiguous: 0 },
  )
  const total =
    classified.estimatedReal + classified.testingSmokeAdmin + classified.ambiguous
  if (total < raw) classified.ambiguous += raw - total
  return normalizeTrafficClassification(raw, classified)
}

function currentTrafficClassification(
  summary: TrafficClassificationInput & {
    traffic: TrafficClassificationInput['traffic'] & {
      classification?: z.infer<typeof trafficClassificationSchema>
    }
  },
) {
  const upstream = summary.traffic.classification
  if (upstream?.raw === summary.traffic.pageViews24h) return upstream
  return classifyHonestFitTraffic(summary)
}

function trafficLabel(item: {
  path?: string
  source?: string
  referrer?: string
  campaign?: string
}) {
  return [item.path, item.source, item.referrer, item.campaign]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function isTestingSmokeAdminTraffic(label: string) {
  return [
    'internal_smoke',
    'local_test',
    'production_probe',
    'system',
    'deploy_smoke',
    'public_profile_smoke',
    'mission_proxy',
    'mission-proxy',
    'mission control',
    'smoke',
    'probe',
    'nginx',
    '/api/health',
    '/api/admin/mission',
    '/admin',
  ].some((pattern) => label.includes(pattern))
}

function isAmbiguousDirectTraffic(label: string) {
  return label === '' || label === 'direct' || label === '(direct)'
}

function isAmbiguousProductPage(label: string) {
  return (
    label === '' ||
    label === '/' ||
    label === '/login' ||
    label.startsWith('/login ') ||
    /^\/c\/[^/\s?#]+\/?$/.test(label)
  )
}

function normalizeTrafficClassification(
  raw: number,
  classified: { estimatedReal: number; testingSmokeAdmin: number; ambiguous: number },
) {
  const testingSmokeAdmin = Math.min(raw, classified.testingSmokeAdmin)
  const ambiguous = Math.min(raw - testingSmokeAdmin, classified.ambiguous)
  const estimatedReal = Math.max(
    0,
    Math.min(raw - testingSmokeAdmin - ambiguous, classified.estimatedReal),
  )
  const assigned = estimatedReal + testingSmokeAdmin + ambiguous
  return {
    raw,
    estimatedReal: assigned < raw ? estimatedReal + (raw - assigned) : estimatedReal,
    testingSmokeAdmin,
    ambiguous,
  }
}

export async function fetchHonestFitMissionSummary(
  options: FetchSummaryOptions = {},
): Promise<HonestFitMissionSummaryResult> {
  const env = options.env ?? process.env
  const summaryUrl = env.HONESTFIT_MISSION_SUMMARY_URL
  const apiSecret = env.HONESTFIT_MISSION_API_SECRET

  if (!summaryUrl || !apiSecret) {
    logHonestFitTelemetryIssue('missing_env', {
      missing: [
        !summaryUrl ? 'HONESTFIT_MISSION_SUMMARY_URL' : null,
        !apiSecret ? 'HONESTFIT_MISSION_API_SECRET' : null,
      ].filter(Boolean),
    })
    return { status: 'unavailable', message: 'HonestFit telemetry is not configured.' }
  }

  try {
    const res = await (options.fetchImpl ?? fetch)(summaryUrl, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${apiSecret}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      logHonestFitTelemetryIssue('upstream_non_ok', {
        upstreamStatus: res.status,
        requestId: res.headers.get('x-request-id') ?? undefined,
      })
      return {
        status: 'error',
        message: 'Unable to fetch HonestFit telemetry.',
        upstreamStatus: res.status,
      }
    }

    const parsed = honestFitMissionSummarySchema.safeParse(await res.json())
    if (!parsed.success) {
      logHonestFitTelemetryIssue('schema_validation_failed', {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
        })),
      })
      return { status: 'error', message: 'HonestFit telemetry response was malformed.' }
    }

    return { status: 'success', summary: parsed.data }
  } catch (error) {
    logHonestFitTelemetryIssue('fetch_failed', {
      errorName: error instanceof Error ? error.name : 'Error',
      errorMessage:
        error instanceof Error ? error.message.slice(0, 160) : 'Unknown error',
    })
    return { status: 'error', message: 'Unable to fetch HonestFit telemetry.' }
  }
}

function normalizeMarketingSummary(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  const cta = record.cta24h ?? record.ctaClicks24h

  return {
    ...record,
    scope: record.scope,
    customSinceSupported: record.customSinceSupported,
    trafficSources24h: record.trafficSources24h ?? record.visitsBySource24h ?? [],
    campaigns24h: record.campaigns24h ?? record.visitsByCampaign24h ?? [],
    topReferrers24h: record.topReferrers24h ?? [],
    cta24h:
      cta && typeof cta === 'object'
        ? {
            getStartedClicks:
              (cta as Record<string, unknown>).getStartedClicks ??
              (cta as Record<string, unknown>).getStarted,
            signInClicks:
              (cta as Record<string, unknown>).signInClicks ??
              (cta as Record<string, unknown>).signIn,
            viewPlansClicks:
              (cta as Record<string, unknown>).viewPlansClicks ??
              (cta as Record<string, unknown>).viewPlans,
            partnerApiEmailClicks:
              (cta as Record<string, unknown>).partnerApiEmailClicks ??
              (cta as Record<string, unknown>).partnerApiEmail,
          }
        : cta,
  }
}
