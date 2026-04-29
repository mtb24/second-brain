import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type {
  HonestFitMissionSummary,
  HonestFitMissionSummaryResult,
} from '@/server/honestFitMissionSummary'

async function fetchHonestFitTelemetry(): Promise<HonestFitMissionSummaryResult> {
  const res = await fetch('/api/honestfit/mission-summary', {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error('Unable to load HonestFit telemetry')
  }
  return res.json()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return 'None'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function statusTone(status: HonestFitMissionSummary['health']['status']) {
  if (status === 'ok') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'blocked') return 'border-red-500/40 bg-red-500/10 text-red-200'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-200'
}

function topList(
  items: { path?: string; source?: string; views: number }[],
  emptyLabel: string,
) {
  const visible = items.slice(0, 3)
  if (visible.length === 0) {
    return <li className="text-slate-500">{emptyLabel}</li>
  }

  return visible.map((item) => (
    <li
      key={`${item.path ?? item.source}-${item.views}`}
      className="flex min-w-0 items-center justify-between gap-3"
    >
      <span className="truncate text-slate-300">{item.path ?? item.source}</span>
      <span className="shrink-0 font-mono text-slate-500">
        {formatNumber(item.views)}
      </span>
    </li>
  ))
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-100">
        {formatNumber(value)}
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h4>
      {children}
    </section>
  )
}

export function HonestFitTelemetryPanelView({
  result,
  isLoading = false,
  error,
}: Readonly<{
  result?: HonestFitMissionSummaryResult
  isLoading?: boolean
  error?: Error | null
}>) {
  const summary = result?.status === 'success' ? result.summary : null
  const statusLabel = summary?.health.status ?? 'unavailable'
  const panelTone = summary
    ? statusTone(summary.health.status)
    : 'border-slate-700 bg-slate-800/40 text-slate-300'

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-slate-100">
            HonestFit Launch Telemetry
          </h3>
          <div className="mt-1 text-xs text-slate-500">
            {summary
              ? `Generated ${formatTimestamp(summary.generatedAt)}`
              : 'Aggregate metrics only'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="text-xs text-slate-500">Loading...</span>
          )}
          <span
            className={`rounded border px-2 py-1 text-xs font-semibold uppercase ${panelTone}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {result?.status === 'unavailable' && (
        <div className="mt-4 rounded border border-amber-900/70 bg-amber-950/30 p-3 text-xs text-amber-100">
          Unavailable: {result.message}
        </div>
      )}

      {(result?.status === 'error' || error) && (
        <div className="mt-4 rounded border border-red-900/70 bg-red-950/30 p-3 text-xs text-red-100">
          Unable to fetch HonestFit telemetry
          {result?.status === 'error' && result.upstreamStatus
            ? ` (${result.upstreamStatus})`
            : ''}
        </div>
      )}

      {summary && (
        <div className="mt-4 grid gap-5 xl:grid-cols-3">
          <Section title="Health">
            <div className={`rounded border p-3 text-xs ${statusTone(summary.health.status)}`}>
              <div className="text-sm font-semibold uppercase">
                {summary.health.status}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-slate-300">
                <span>Blocking</span>
                <span className="text-right font-mono">
                  {formatNumber(summary.health.blockingIssueCount)}
                </span>
                <span>Warnings</span>
                <span className="text-right font-mono">
                  {formatNumber(summary.health.warningCount)}
                </span>
                {summary.health.appVersion && (
                  <>
                    <span>Version</span>
                    <span className="text-right font-mono">
                      {summary.health.appVersion}
                    </span>
                  </>
                )}
              </div>
            </div>
          </Section>

          <Section title="Traffic 24h">
            <Metric label="Page views" value={summary.traffic.pageViews24h} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Top pages
                </div>
                <ul className="mt-2 space-y-1 text-xs">
                  {topList(summary.traffic.topPages24h, 'No page views')}
                </ul>
              </div>
              <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Top referrers
                </div>
                <ul className="mt-2 space-y-1 text-xs">
                  {topList(summary.traffic.topReferrers24h, 'No referrers')}
                </ul>
              </div>
            </div>
          </Section>

          <Section title="Signups">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Free total" value={summary.signups.freeTotal} />
              <Metric label="Free 24h" value={summary.signups.free24h} />
              <Metric label="Active Pro" value={summary.signups.proActive} />
              <Metric label="Pro 24h" value={summary.signups.pro24h} />
            </div>
          </Section>

          <Section title="Funnel 24h">
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Magic requested"
                value={summary.funnel.magicLinksRequested24h}
              />
              <Metric
                label="Magic consumed"
                value={summary.funnel.magicLinksConsumed24h}
              />
              <Metric
                label="Profile viewed"
                value={summary.funnel.profileViews24h}
              />
              <Metric
                label="Capture saved"
                value={summary.funnel.captureSaved24h}
              />
              <Metric label="Fit viewed" value={summary.funnel.fitViewed24h} />
              <Metric
                label="Resume generated"
                value={summary.funnel.resumeGenerated24h}
              />
            </div>
          </Section>

          <Section title="Errors 24h">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Total" value={summary.errors.total24h} />
              <Metric label="Critical" value={summary.errors.critical24h} />
            </div>
            <ul className="space-y-2 text-xs">
              {summary.errors.recent.slice(0, 3).map((item) => (
                <li
                  key={`${item.at}-${item.route}-${item.requestId ?? item.status}`}
                  className="rounded border border-red-900/50 bg-red-950/20 p-2 text-red-100"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono">{item.route}</span>
                    <span className="shrink-0 font-mono">{item.status}</span>
                  </div>
                  <div className="mt-1 truncate text-red-100/80">
                    {item.message}
                  </div>
                  {item.requestId && (
                    <div className="mt-1 truncate font-mono text-red-100/60">
                      {item.requestId}
                    </div>
                  )}
                </li>
              ))}
              {summary.errors.recent.length === 0 && (
                <li className="text-xs text-slate-500">No recent errors.</li>
              )}
            </ul>
          </Section>

          <Section title="Billing">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Active Pro" value={summary.billing.activePro} />
              <Metric
                label="Cancellations"
                value={summary.billing.scheduledCancellations}
              />
              <Metric
                label="Webhook events"
                value={summary.billing.stripeWebhookEvents24h}
              />
              <Metric
                label="Webhook failures"
                value={summary.billing.stripeWebhookFailures24h}
              />
            </div>
            <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3 text-xs">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Last webhook
              </div>
              <div className="mt-1 text-slate-200">
                {formatTimestamp(summary.billing.lastStripeWebhookAt)}
              </div>
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}

export function HonestFitTelemetryPanel() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['honestfit-mission-summary'],
    queryFn: fetchHonestFitTelemetry,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-2">
      <HonestFitTelemetryPanelView
        result={data}
        isLoading={isLoading || isFetching}
        error={error as Error | null}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
