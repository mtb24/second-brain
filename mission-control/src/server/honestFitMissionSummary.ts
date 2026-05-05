import { z } from 'zod'

const numberMetric = z.number().finite().nonnegative().catch(0)
const optionalDateString = z.string().datetime().nullable().catch(null)
const displayString = z.string().transform(redactPrivateText)
const optionalDisplayString = z.string().transform(redactPrivateText).optional()
const flexibleDisplayString = z
  .preprocess((value) => textFromUnknown(value) ?? '', z.string())
  .transform(redactPrivateText)
const optionalFlexibleDisplayString = z
  .preprocess((value) => textFromUnknown(value), z.string().optional())
  .transform((value) => (value ? redactPrivateText(value) : undefined))

function redactPrivateText(value: string): string {
  return value
    .split(/[?#]/)[0]
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted]')
}

function textFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return undefined

  const record = value as Record<string, unknown>
  const title = typeof record.title === 'string' ? record.title : undefined
  const detail = typeof record.detail === 'string' ? record.detail : undefined
  const message =
    typeof record.message === 'string' ? record.message : undefined

  if (title && detail) return `${title}: ${detail}`
  return detail ?? message ?? title
}

function logHonestFitTelemetryIssue(
  reason: string,
  details: Record<string, unknown> = {},
) {
  console.warn('[honestfit-mission-summary]', { reason, ...details })
}

const rankedMetricSchema = z.object({
  path: optionalDisplayString,
  source: optionalDisplayString,
  views: numberMetric,
})

const marketingRankedMetricSchema = z.object({
  source: optionalDisplayString,
  referrer: optionalDisplayString,
  campaign: optionalDisplayString,
  visits: numberMetric,
})

const trafficClassificationSchema = z.object({
  raw: numberMetric,
  estimatedReal: numberMetric,
  testingSmokeAdmin: numberMetric,
  ambiguous: numberMetric,
})

const recentErrorSchema = z.object({
  at: z.string().datetime().catch(''),
  source: displayString.catch('server'),
  route: displayString.catch('unknown'),
  status: z.number().int().catch(0),
  message: displayString.catch('Redacted error'),
  requestId: optionalDisplayString,
})

const previousWindowSchema = z
  .object({
    traffic: z
      .object({
        pageViews24h: numberMetric.optional(),
      })
      .optional(),
    signups: z
      .object({
        pro24h: numberMetric.optional(),
      })
      .optional(),
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

export const honestFitMissionSummarySchema = z.object({
  generatedAt: z.string().datetime(),
  window: z.string().catch('24h'),
  health: z.object({
    status: z.enum(['ok', 'warning', 'blocked']).catch('warning'),
    blockingIssueCount: numberMetric,
    warningCount: numberMetric,
    appVersion: z.string().optional(),
  }),
  traffic: z
    .object({
      pageViews24h: numberMetric,
      topPages24h: z.array(rankedMetricSchema).catch([]),
      topReferrers24h: z.array(rankedMetricSchema).catch([]),
      classification: trafficClassificationSchema.optional(),
    })
    .passthrough(),
  signups: z.object({
    freeTotal: numberMetric,
    free24h: numberMetric,
    proActive: numberMetric,
    pro24h: numberMetric,
    scheduledCancellations: numberMetric,
  }),
  funnel: z.object({
    magicLinksRequested24h: numberMetric,
    magicLinksConsumed24h: numberMetric,
    profileViews24h: numberMetric,
    captureStarted24h: numberMetric,
    captureSaved24h: numberMetric,
    fitViewed24h: numberMetric,
    fitReportsRequested24h: numberMetric,
    resumeGenerated24h: numberMetric,
  }),
  errors: z.object({
    total24h: numberMetric,
    critical24h: numberMetric,
    recent: z.array(recentErrorSchema).catch([]),
  }),
  billing: z.object({
    activePro: numberMetric,
    scheduledCancellations: numberMetric,
    stripeWebhookEvents24h: numberMetric,
    stripeWebhookFailures24h: numberMetric,
    lastStripeWebhookAt: optionalDateString,
  }),
  previous: previousWindowSchema,
  funnelGraph: z
    .object({
      insight: optionalFlexibleDisplayString,
    })
    .passthrough()
    .optional(),
  ops: z
    .object({
      actionItems: z
        .array(flexibleDisplayString)
        .catch([])
        .transform((items) => items.filter(Boolean))
        .optional(),
      resendAlerts24h: numberMetric.optional(),
    })
    .passthrough()
    .optional(),
  marketing: z.preprocess(
    normalizeMarketingSummary,
    z
      .object({
        trafficSources24h: z.array(marketingRankedMetricSchema).catch([]),
        topReferrers24h: z.array(marketingRankedMetricSchema).catch([]),
        campaigns24h: z.array(marketingRankedMetricSchema).catch([]),
        cta24h: z
          .object({
            getStartedClicks: numberMetric,
            signInClicks: numberMetric,
            viewPlansClicks: numberMetric,
            partnerApiEmailClicks: numberMetric,
          })
          .catch({
            getStartedClicks: 0,
            signInClicks: 0,
            viewPlansClicks: 0,
            partnerApiEmailClicks: 0,
          }),
      })
      .optional(),
  ),
}).transform((summary) => ({
  ...summary,
  traffic: {
    pageViews24h: summary.traffic.pageViews24h,
    topPages24h: summary.traffic.topPages24h,
    topReferrers24h: summary.traffic.topReferrers24h,
    classification: currentTrafficClassification(summary),
  },
}))

export type HonestFitMissionSummary = z.infer<
  typeof honestFitMissionSummarySchema
>

export type HonestFitMissionSummaryResult =
  | { status: 'success'; summary: HonestFitMissionSummary }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string; upstreamStatus?: number }

type FetchSummaryOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  since?: string | null
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
    topReferrers24h?: {
      source?: string
      referrer?: string
      campaign?: string
      visits: number
    }[]
    campaigns24h?: {
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
        if (isTestingSmokeAdminTraffic(label)) {
          totals.testingSmokeAdmin += item.visits
        } else if (isAmbiguousDirectTraffic(label)) {
          totals.ambiguous += item.visits
        } else {
          totals.estimatedReal += item.visits
        }
        return totals
      },
      { estimatedReal: 0, testingSmokeAdmin: 0, ambiguous: 0 },
    )
    const classifiedTotal =
      classified.estimatedReal +
      classified.testingSmokeAdmin +
      classified.ambiguous
    if (classifiedTotal < raw) {
      classified.ambiguous += raw - classifiedTotal
    }

    return normalizeTrafficClassification(raw, classified)
  }

  const classified = summary.traffic.topPages24h.reduce(
    (totals, item) => {
      const label = trafficLabel(item)
      if (isTestingSmokeAdminTraffic(label)) {
        totals.testingSmokeAdmin += item.views
      } else if (isAmbiguousProductPage(label)) {
        totals.ambiguous += item.views
      } else {
        totals.estimatedReal += item.views
      }
      return totals
    },
    { estimatedReal: 0, testingSmokeAdmin: 0, ambiguous: 0 },
  )

  const classifiedTotal =
    classified.estimatedReal +
    classified.testingSmokeAdmin +
    classified.ambiguous
  if (classifiedTotal < raw) {
    classified.ambiguous += raw - classifiedTotal
  }

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
  classified: {
    estimatedReal: number
    testingSmokeAdmin: number
    ambiguous: number
  },
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
    return {
      status: 'unavailable',
      message: 'HonestFit telemetry is not configured.',
    }
  }

  try {
    const url = summaryUrlWithSince(summaryUrl, options.since)
    const res = await (options.fetchImpl ?? fetch)(url, {
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
      return {
        status: 'error',
        message: 'HonestFit telemetry response was malformed.',
      }
    }

    return { status: 'success', summary: parsed.data }
  } catch (error) {
    logHonestFitTelemetryIssue('fetch_failed', {
      errorName: error instanceof Error ? error.name : 'Error',
      errorMessage:
        error instanceof Error ? error.message.slice(0, 160) : 'Unknown error',
    })
    return {
      status: 'error',
      message: 'Unable to fetch HonestFit telemetry.',
    }
  }
}

function summaryUrlWithSince(summaryUrl: string, since?: string | null) {
  if (!since) return summaryUrl
  const parsedSince = new Date(since)
  if (Number.isNaN(parsedSince.getTime())) return summaryUrl

  const url = new URL(summaryUrl)
  url.searchParams.set('since', parsedSince.toISOString())
  return url.toString()
}

function normalizeMarketingSummary(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  const cta = record.cta24h ?? record.ctaClicks24h

  return {
    ...record,
    trafficSources24h:
      record.trafficSources24h ?? record.visitsBySource24h ?? [],
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
