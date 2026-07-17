import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  GitCommitHorizontal,
  ShieldCheck,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { MissionWorkspacePage, WorkspaceSourceState } from './MissionWorkspacePage'
import { useHonestFitMissionSummary } from './useHonestFitMissionSummary'
import {
  formattedTimestamp,
  missionOperationalState,
  openIncidents,
  todayAttentionItems,
  unreadFeedbackCount,
} from './missionViewModel'
import type { HonestFitMissionSummary } from '@/server/honestFitMissionSummary'

const stateCopy = {
  healthy: {
    title: 'HonestFit is operating normally',
    detail: 'No active exception currently requires operator action.',
  },
  watch: {
    title: 'HonestFit needs monitoring',
    detail: 'Current signals deserve review, but no blocking condition is declared.',
  },
  attention: {
    title: 'HonestFit needs operator attention',
    detail: 'A blocking, degraded, or critical production signal is active.',
  },
} as const

function deltaLabel(current: number, previous?: number) {
  if (previous == null) return 'Previous window unavailable'
  const delta = current - previous
  if (delta === 0) return 'No change from previous 24h'
  return `${delta > 0 ? '+' : ''}${delta} from previous 24h`
}

export function TodayWorkspace() {
  const query = useHonestFitMissionSummary()
  return (
    <MissionWorkspacePage
      eyebrow="Today"
      title="What needs my attention now?"
      question="Production state, active exceptions, and the next operator decision—before everything else."
    >
      {query.isLoading ? (
        <WorkspaceSourceState
          title="Loading HonestFit production"
          detail="Reading the protected aggregate summary."
        />
      ) : query.error || !query.data || query.data.status === 'error' ? (
        <WorkspaceSourceState
          title="HonestFit source failed"
          detail="Today cannot read the protected source right now. The remaining Mission workspaces stay available."
          tone="critical"
        />
      ) : query.data.status === 'unavailable' ? (
        <WorkspaceSourceState
          title="HonestFit source unavailable"
          detail={query.data.message}
          tone="warning"
        />
      ) : (
        <TodaySummary summary={query.data.summary} />
      )}
    </MissionWorkspacePage>
  )
}

export function TodaySummary({
  summary,
}: Readonly<{ summary: HonestFitMissionSummary }>) {
  const state = missionOperationalState(summary)
  const stateText = stateCopy[state]
  const incidents = openIncidents(summary)
  const actions = todayAttentionItems(summary)
  const campaign = summary.billing.campaign
  const unread = unreadFeedbackCount(summary)
  const degraded = summary.errors.subsystems
    ? Object.entries(summary.errors.subsystems).filter(
        ([, subsystem]) => subsystem.status === 'degraded',
      )
    : []
  const healthyCount = summary.errors.subsystems
    ? Object.values(summary.errors.subsystems).filter(
        (subsystem) => subsystem.status === 'ok',
      ).length
    : null
  const knownBuilds = Array.from(
    new Set(incidents.map((incident) => incident.buildSha).filter(Boolean)),
  )
  const StateIcon = state === 'healthy' ? CheckCircle2 : AlertTriangle

  return (
    <div className="space-y-5">
      <section
        className={`mission-card overflow-hidden border-l-4 p-5 sm:p-6 ${
          state === 'healthy'
            ? 'border-l-emerald-600'
            : state === 'watch'
              ? 'border-l-amber-600'
              : 'border-l-red-700'
        }`}
        aria-labelledby="today-current-state"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <StateIcon
              className={`mt-0.5 h-6 w-6 shrink-0 ${state === 'healthy' ? 'text-emerald-700' : state === 'watch' ? 'text-amber-700' : 'text-red-800'}`}
              aria-hidden="true"
            />
            <div>
              <div className="mission-eyebrow">Current production state</div>
              <h2 id="today-current-state" className="mt-2 text-2xl font-semibold tracking-tight text-mission-ink">
                {stateText.title}
              </h2>
              <p className="mission-meta mt-1 max-w-2xl">{stateText.detail}</p>
            </div>
          </div>
          <div className="shrink-0 text-xs leading-5 text-mission-muted sm:rounded-lg sm:border sm:border-mission-border sm:bg-mission-canvas sm:px-4 sm:py-3 sm:text-sm">
            <div className="font-semibold text-mission-ink">Updated {formattedTimestamp(summary.generatedAt)}</div>
            <div>Production · protected read only</div>
          </div>
        </div>
        <dl className="mt-5 divide-y divide-mission-border border-y border-mission-border sm:grid sm:grid-cols-3 sm:gap-3 sm:divide-y-0 sm:border-0">
          <Signal label="Active incidents" value={`${incidents.length}`} detail={summary.contract.incidents === 'available' ? 'Sanitized contract available' : 'Incident contract unavailable'} />
          <Signal label="Campaign failures" value={campaign ? `${campaign.paymentFailures24h + campaign.activationFailures24h}` : 'Unavailable'} detail={campaign ? 'Rolling 24 hours' : 'Campaign aggregate missing'} />
          <Signal label="Unread feedback" value={unread == null ? 'Unavailable' : `${unread}`} detail={unread == null ? 'Awaiting production contract deployment' : 'Bounded read-only projection'} />
        </dl>
      </section>

      <div className="min-w-0 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
        <section className="min-w-0 mission-card p-4 sm:p-6" aria-labelledby="today-attention">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="mission-eyebrow">Decision queue</div>
              <h2 id="today-attention" className="mt-2 text-xl font-semibold text-mission-ink">Recommended actions</h2>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Maximum three</span>
          </div>
          {actions.length === 0 ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">No recommended action</h3>
                  <p className="mt-1 text-sm leading-6 opacity-80">Continue monitoring the next protected summary.</p>
                </div>
              </div>
            </div>
          ) : (
            <ol className="mt-4 divide-y divide-mission-border">
              {actions.map((item, index) => (
                <li key={item.id} className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
                  <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-mission-navy text-sm font-semibold text-white sm:flex" aria-hidden="true">{index + 1}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-mission-ink">{item.title}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${item.priority === 'critical' ? 'border-red-300 bg-red-50 text-red-900' : item.priority === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>{item.priority}</span>
                    </div>
                    <p className="mission-meta mt-1">{item.detail}</p>
                  </div>
                  <Link to={item.href} className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-mission-border bg-white px-3 text-sm font-semibold text-mission-cobalt hover:border-mission-cobalt hover:bg-blue-50 sm:w-auto">
                    {item.action}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="min-w-0 mission-card p-4 sm:p-6" aria-labelledby="today-release">
          <div className="mission-eyebrow">Release authority</div>
          <h2 id="today-release" className="mt-2 text-xl font-semibold text-mission-ink">Production build state</h2>
          <div className="mt-3 flex min-w-0 items-start gap-3 sm:rounded-xl sm:border sm:border-mission-border sm:bg-mission-canvas sm:p-4">
            <GitCommitHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-mission-cobalt" aria-hidden="true" />
            <div>
              <div className="font-semibold text-mission-ink">App version {summary.health.appVersion ?? 'unavailable'}</div>
              <p className="mission-meta mt-1 break-all">
                {knownBuilds.length > 0
                  ? `Active incident evidence references build ${knownBuilds.join(', ')}.`
                  : 'The protected summary does not declare a deployed build SHA.'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-3 text-sm text-mission-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Mission is read-only; release and deployment remain manual.
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <details className="group mission-card overflow-hidden">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:hidden">
            <span>
              <span className="mission-eyebrow block">What changed</span>
              <span className="mt-1 block text-base font-semibold text-mission-ink">Comparable 24-hour signals</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-mission-cobalt transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </summary>
          <section className="border-t border-mission-border px-5 pb-5 pt-4" aria-labelledby="today-changed">
            <h2 id="today-changed" className="sr-only">Comparable 24-hour signals</h2>
            <div className="divide-y divide-mission-border">
            <ChangeRow label="Page-view events" value={summary.traffic.pageViews24h} detail={deltaLabel(summary.traffic.pageViews24h, summary.previous?.traffic?.pageViews24h)} />
            <ChangeRow label="Paid signup events" value={summary.signups.pro24h} detail={deltaLabel(summary.signups.pro24h, summary.previous?.signups?.pro24h)} />
            <ChangeRow label="Critical error events" value={summary.errors.critical24h} detail={deltaLabel(summary.errors.critical24h, summary.previous?.errors?.critical24h)} />
            </div>
            <p className="mission-meta mt-4">These are aggregate event counts, not unique users or conversion evidence.</p>
          </section>
        </details>

        <details className="group mission-card overflow-hidden">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:hidden">
            <span>
              <span className="mission-eyebrow block">Systems</span>
              <span className="mt-1 block text-base font-semibold text-mission-ink">{healthyCount == null ? 'Subsystem status unavailable' : `${healthyCount} healthy · ${degraded.length} degraded`}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-mission-cobalt transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </summary>
          <section className="border-t border-mission-border px-5 pb-5 pt-4" aria-labelledby="today-systems">
          <h2 id="today-systems" className="sr-only">Healthy systems stay collapsed</h2>
          {healthyCount == null ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <CircleDashed className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">Subsystem contract unavailable</h3>
                <p className="mt-1 text-sm leading-6 opacity-80">Aggregate errors loaded without canonical subsystem status.</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">{healthyCount} healthy subsystems</h3>
                  <p className="mt-1 text-sm leading-6 opacity-80">Application, authentication, processing, billing, webhooks, voice, and database collapse when healthy.</p>
                </div>
              </div>
              {degraded.map(([name, subsystem]) => (
                <div key={name} className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                  <div className="font-semibold capitalize">{name.replaceAll('_', ' ')} degraded</div>
                  <div className="mt-1 text-sm opacity-80">{subsystem.occurrences24h} observed occurrences in 24 hours</div>
                </div>
              ))}
            </div>
          )}
          <p className="mission-meta mt-4">
            {summary.traffic.classification.testingSmokeAdmin > 0
              ? `${summary.traffic.classification.testingSmokeAdmin} traffic events are classified as controlled testing, smoke, or admin activity.`
              : 'No controlled testing, smoke, or admin traffic is classified in this window.'}{' '}
            Incident origin is not inferred when HonestFit does not declare it.
          </p>
          </section>
        </details>
      </div>
    </div>
  )
}

function Signal({ label, value, detail }: Readonly<{ label: string; value: string; detail: string }>) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2.5 sm:block sm:rounded-xl sm:border sm:border-mission-border sm:bg-mission-canvas sm:p-4">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-mission-muted sm:text-xs">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums text-mission-ink sm:mt-1 sm:text-2xl">{value}</dd>
      <dd className="mission-meta mt-1 hidden sm:block">{detail}</dd>
    </div>
  )
}

function ChangeRow({ label, value, detail }: Readonly<{ label: string; value: number; detail: string }>) {
  return (
    <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div>
        <div className="text-sm font-medium text-mission-ink">{label}</div>
        <div className="mission-meta mt-0.5">{detail}</div>
      </div>
      <div className="text-2xl font-semibold tabular-nums text-mission-ink">{value}</div>
    </div>
  )
}
