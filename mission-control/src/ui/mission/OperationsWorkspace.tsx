import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'
import { MissionWorkspacePage, WorkspaceSourceState } from './MissionWorkspacePage'
import { useHonestFitMissionSummary } from './useHonestFitMissionSummary'
import { formattedTimestamp, openIncidents } from './missionViewModel'
import { incidentGuidance, operationsSubsystemRows } from './operationsModel'
import type { HonestFitMissionSummary } from '@/server/honestFitMissionSummary'

const severityStyle = {
  warning: 'border-amber-300 bg-amber-50 text-amber-950',
  error: 'border-orange-300 bg-orange-50 text-orange-950',
  critical: 'border-red-300 bg-red-50 text-red-950',
} as const

export function OperationsWorkspace() {
  const query = useHonestFitMissionSummary()
  return (
    <MissionWorkspacePage
      eyebrow="Operations"
      title="Is HonestFit functioning reliably?"
      question="Canonical system health and sanitized incident evidence, with Sentry retained as technical authority."
    >
      {query.isLoading ? (
        <WorkspaceSourceState title="Loading operational evidence" detail="Reading protected subsystem and incident aggregates." />
      ) : query.error || !query.data || query.data.status === 'error' ? (
        <WorkspaceSourceState title="HonestFit source failed" detail="Operational evidence could not be read. No healthy state is inferred." tone="critical" />
      ) : query.data.status === 'unavailable' ? (
        <WorkspaceSourceState title="HonestFit source unavailable" detail={query.data.message} tone="warning" />
      ) : (
        <OperationsSummary summary={query.data.summary} />
      )}
    </MissionWorkspacePage>
  )
}

export function OperationsSummary({
  summary,
}: Readonly<{ summary: HonestFitMissionSummary }>) {
  const rows = operationsSubsystemRows(summary)
  const healthy = rows.filter((row) => row.status === 'healthy')
  const degraded = rows.filter((row) => row.status === 'degraded')
  const unavailable = rows.filter((row) => row.status === 'unavailable')
  const incidents = openIncidents(summary)

  return (
    <div className="space-y-5">
      <section className="mission-card p-5 sm:p-6" aria-labelledby="operations-overview">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mission-eyebrow">Reliability overview</div>
            <h2 id="operations-overview" className="mt-2 text-2xl font-semibold tracking-tight text-mission-ink">
              {degraded.length > 0 || incidents.length > 0
                ? 'Active exceptions need review'
                : summary.contract.incidents === 'available'
                  ? 'No active operational incidents'
                  : 'Incident contract unavailable'}
            </h2>
            <p className="mission-meta mt-1">
              {degraded.length} degraded · {healthy.length} healthy · {unavailable.length} measurements unavailable
            </p>
          </div>
          <div className="rounded-lg border border-mission-border bg-mission-canvas px-4 py-3 text-sm">
            <div className="font-semibold text-mission-ink">{summary.errors.total24h} error events</div>
            <div className="mt-0.5 text-xs text-mission-muted">Rolling 24 hours · {summary.errors.critical24h} critical</div>
          </div>
        </div>

        {degraded.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {degraded.map((row) => (
              <div key={row.category} className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">{row.label} degraded</h3>
                    <p className="mt-1 text-sm leading-6 opacity-80">{row.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {healthy.length > 0 ? (
          <details className="group mt-5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-950">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold marker:hidden">
              <span className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                {healthy.length} healthy subsystems
              </span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            <div className="grid gap-x-6 border-t border-emerald-200 px-4 pb-4 sm:grid-cols-2">
              {healthy.map((row) => (
                <div key={row.category} className="flex min-h-12 items-center justify-between gap-3 border-b border-emerald-200 py-3 last:border-b-0">
                  <span className="text-sm font-medium">{row.label}</span>
                  <span className="text-xs font-semibold">Healthy · {row.occurrences24h ?? 0} events</span>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        {unavailable.length > 0 ? (
          <div className="mt-4 rounded-xl border border-mission-border bg-mission-canvas p-4">
            <div className="flex items-start gap-3">
              <Activity className="mt-0.5 h-5 w-5 shrink-0 text-mission-muted" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-mission-ink">Measurement coverage gaps</h3>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-mission-muted">
                  {unavailable.map((row) => <li key={row.category}><span className="font-medium text-mission-ink">{row.label}:</span> {row.detail}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="operations-incidents">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mission-eyebrow">Active exceptions</div>
            <h2 id="operations-incidents" className="mt-2 text-xl font-semibold text-mission-ink">Sanitized incidents</h2>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Sentry is technical authority</span>
        </div>

        {summary.contract.incidents !== 'available' ? (
          <WorkspaceSourceState
            title="Incident contract unavailable"
            detail="Aggregate errors loaded, but sanitized incident and subsystem detail is unavailable. Mission does not represent this as no incidents."
            tone="warning"
          />
        ) : incidents.length === 0 ? (
          <div className="mission-card p-6 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-700" aria-hidden="true" />
            <h3 className="mt-3 text-lg font-semibold text-mission-ink">No active incidents</h3>
            <p className="mission-meta mt-1">The sanitized incident contract is available and returned no open or monitoring incidents.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => {
              const guidance = incidentGuidance(incident.category)
              return (
                <details key={incident.reference} className="group mission-card overflow-hidden">
                  <summary className="grid min-h-16 cursor-pointer list-none gap-3 px-5 py-4 marker:hidden sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                      <ShieldAlert className={`mt-0.5 h-5 w-5 shrink-0 ${incident.severity === 'critical' ? 'text-red-800' : incident.severity === 'error' ? 'text-orange-800' : 'text-amber-800'}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-mission-cobalt">{incident.reference}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${severityStyle[incident.severity]}`}>{incident.severity}</span>
                          <span className="rounded-full border border-mission-border bg-mission-canvas px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-mission-muted">{incident.status}</span>
                        </div>
                        <h3 className="mt-2 font-semibold text-mission-ink">{incident.affectedArea.replaceAll('_', ' ')}</h3>
                        <p className="mission-meta mt-0.5">{incident.normalizedRoute} · {incident.occurrenceCount} {incident.occurrenceCount === 1 ? 'occurrence' : 'occurrences'}</p>
                      </div>
                    </div>
                    <span className="inline-flex min-h-11 items-center justify-between gap-2 text-sm font-semibold text-mission-cobalt sm:justify-end">
                      Review sanitized detail
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                    </span>
                  </summary>
                  <div className="border-t border-mission-border bg-mission-canvas px-5 py-5">
                    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <IncidentDatum label="Area" value={incident.category.replaceAll('_', ' ')} />
                      <IncidentDatum label="Affected build" value={incident.buildSha ?? 'Build unavailable'} mono={Boolean(incident.buildSha)} />
                      <IncidentDatum label="First seen" value={formattedTimestamp(incident.firstSeenAt)} />
                      <IncidentDatum label="Last seen" value={formattedTimestamp(incident.lastSeenAt)} />
                    </dl>
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-mission-border bg-white p-4">
                        <h4 className="text-sm font-semibold text-mission-ink">Concise impact interpretation</h4>
                        <p className="mission-meta mt-1">{guidance.impact}</p>
                      </div>
                      <div className="rounded-xl border border-mission-border bg-white p-4">
                        <h4 className="text-sm font-semibold text-mission-ink">Recommended operator action</h4>
                        <p className="mission-meta mt-1">{guidance.action}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-mission-border pt-4">
                      <p className="text-xs leading-5 text-mission-muted">Origin classification is not declared; Mission does not infer organic or controlled synthetic activity.</p>
                      {incident.sentry ? (
                        <a href={incident.sentry.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-mission-cobalt px-4 text-sm font-semibold text-white hover:bg-mission-navy">
                          Open safe Sentry event
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="inline-flex min-h-11 items-center rounded-lg border border-mission-border bg-white px-4 text-sm font-semibold text-mission-muted">Sentry link unavailable</span>
                      )}
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function IncidentDatum({ label, value, mono = false }: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-mission-muted">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-semibold text-mission-ink ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
