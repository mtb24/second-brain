import { z } from 'zod'

const numberMetric = z.number().finite().nonnegative().catch(0)
const optionalDateString = z.string().datetime().nullable().catch(null)
const displayString = z.string().transform(redactPrivateText)
const optionalDisplayString = z.string().transform(redactPrivateText).optional()

function redactPrivateText(value: string): string {
  return value
    .split(/[?#]/)[0]
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted]')
}

const rankedMetricSchema = z.object({
  path: optionalDisplayString,
  source: optionalDisplayString,
  views: numberMetric,
})

const recentErrorSchema = z.object({
  at: z.string().datetime().catch(''),
  source: displayString.catch('server'),
  route: displayString.catch('unknown'),
  status: z.number().int().catch(0),
  message: displayString.catch('Redacted error'),
  requestId: optionalDisplayString,
})

export const honestFitMissionSummarySchema = z.object({
  generatedAt: z.string().datetime(),
  window: z.string().catch('24h'),
  health: z.object({
    status: z.enum(['ok', 'warning', 'blocked']).catch('warning'),
    blockingIssueCount: numberMetric,
    warningCount: numberMetric,
    appVersion: z.string().optional(),
  }),
  traffic: z.object({
    pageViews24h: numberMetric,
    topPages24h: z.array(rankedMetricSchema).catch([]),
    topReferrers24h: z.array(rankedMetricSchema).catch([]),
  }),
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
})

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
}

export async function fetchHonestFitMissionSummary(
  options: FetchSummaryOptions = {},
): Promise<HonestFitMissionSummaryResult> {
  const env = options.env ?? process.env
  const summaryUrl = env.HONESTFIT_MISSION_SUMMARY_URL
  const apiSecret = env.HONESTFIT_MISSION_API_SECRET

  if (!summaryUrl || !apiSecret) {
    return {
      status: 'unavailable',
      message: 'HonestFit telemetry is not configured.',
    }
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
      return {
        status: 'error',
        message: 'Unable to fetch HonestFit telemetry.',
        upstreamStatus: res.status,
      }
    }

    const parsed = honestFitMissionSummarySchema.safeParse(await res.json())
    if (!parsed.success) {
      return {
        status: 'error',
        message: 'HonestFit telemetry response was malformed.',
      }
    }

    return { status: 'success', summary: parsed.data }
  } catch {
    return {
      status: 'error',
      message: 'Unable to fetch HonestFit telemetry.',
    }
  }
}
