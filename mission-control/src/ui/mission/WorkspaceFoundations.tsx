import { AlertTriangle, CheckCircle2, CircleSlash2 } from 'lucide-react'
import { MissionWorkspacePage, WorkspaceSourceState } from './MissionWorkspacePage'
import { useHonestFitMissionSummary } from './useHonestFitMissionSummary'
import {
  formattedTimestamp,
  missionOperationalState,
  openIncidents,
} from './missionViewModel'
import type { HonestFitMissionSummary } from '@/server/honestFitMissionSummary'

function WorkspaceData({
  children,
}: Readonly<{ children: (summary: HonestFitMissionSummary) => React.ReactNode }>) {
  const query = useHonestFitMissionSummary()
  if (query.isLoading) {
    return (
      <WorkspaceSourceState
        title="Loading HonestFit production"
        detail="Reading the protected aggregate summary."
      />
    )
  }
  if (query.error || !query.data || query.data.status === 'error') {
    return (
      <WorkspaceSourceState
        title="HonestFit source failed"
        detail="This workspace cannot read its protected source right now. Other Mission workspaces remain available."
        tone="critical"
      />
    )
  }
  if (query.data.status === 'unavailable') {
    return (
      <WorkspaceSourceState
        title="HonestFit source unavailable"
        detail={query.data.message}
        tone="warning"
      />
    )
  }
  return <>{children(query.data.summary)}</>
}

function EvidenceRow({
  label,
  value,
  scope,
}: Readonly<{ label: string; value: string | number; scope?: string }>) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-mission-border py-3 last:border-b-0">
      <div>
        <div className="text-sm font-medium text-mission-ink">{label}</div>
        {scope ? <div className="mt-0.5 text-xs text-mission-muted">{scope}</div> : null}
      </div>
      <div className="text-sm font-semibold tabular-nums text-mission-ink">{value}</div>
    </div>
  )
}

export function TodayFoundation() {
  return (
    <MissionWorkspacePage
      eyebrow="Today"
      title="What needs my attention now?"
      question="HonestFit’s current state, active exceptions, and the next operator decision."
    >
      <WorkspaceData>
        {(summary) => {
          const state = missionOperationalState(summary)
          const incidents = openIncidents(summary)
          const campaign = summary.billing.campaign
          const paymentProblems = campaign
            ? campaign.paymentFailures24h + campaign.activationFailures24h
            : null
          return (
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="mission-card p-5 lg:col-span-2">
                <div className="mission-eyebrow">Current state</div>
                <div className="mt-3 flex items-start gap-3">
                  {state === 'healthy' ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-amber-700" aria-hidden="true" />
                  )}
                  <div>
                    <h2 className="text-xl font-semibold text-mission-ink">
                      {state === 'healthy' ? 'Operating normally' : state === 'watch' ? 'Watch current signals' : 'Operator attention required'}
                    </h2>
                    <p className="mission-meta mt-1">
                      {incidents.length} active {incidents.length === 1 ? 'incident' : 'incidents'} ·{' '}
                      {paymentProblems == null ? 'campaign source unavailable' : `${paymentProblems} payment or activation problems in 24h`}
                    </p>
                  </div>
                </div>
              </section>
              <section className="mission-card p-5">
                <div className="mission-eyebrow">Release</div>
                <h2 className="mt-3 text-lg font-semibold text-mission-ink">
                  HonestFit {summary.health.appVersion ?? 'version unavailable'}
                </h2>
                <p className="mission-meta mt-1">
                  Summary generated {formattedTimestamp(summary.generatedAt)}. The protected summary does not declare the deployed build SHA.
                </p>
              </section>
            </div>
          )
        }}
      </WorkspaceData>
    </MissionWorkspacePage>
  )
}

export function ProductFoundation() {
  return (
    <MissionWorkspacePage
      eyebrow="Product"
      title="Are users reaching value?"
      question="Aggregate journey evidence, with unsupported user and retention measurements kept explicit."
    >
      <WorkspaceData>
        {(summary) => (
          <section className="mission-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-mission-ink">Event journey</h2>
                <p className="mission-meta mt-1">Interest is visible, but unique-user conversion is not measurable.</p>
              </div>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                Event counts only
              </span>
            </div>
            <div className="mt-4">
              <EvidenceRow label="Homepage and pricing views" value={summary.traffic.pageViews24h} scope="Rolling 24 hours" />
              <EvidenceRow label="Sign-in requests" value={summary.funnel.magicLinksRequested24h} scope="Rolling 24 hours" />
              <EvidenceRow label="Story capture saved" value={summary.funnel.captureSaved24h} scope="Rolling 24 hours" />
              <EvidenceRow label="Fit or kit activity" value={summary.funnel.fitReportsRequested24h + summary.funnel.resumeGenerated24h} scope="Rolling 24 hours" />
              <EvidenceRow label="Unique users" value="Unavailable" scope="Not instrumented" />
              <EvidenceRow label="Retention" value="Unsupported" scope="Unique-user evidence unavailable" />
            </div>
          </section>
        )}
      </WorkspaceData>
    </MissionWorkspacePage>
  )
}

export function RevenueFoundation() {
  return (
    <MissionWorkspacePage
      eyebrow="Revenue"
      title="Is the Job Search Campaign selling and activating correctly?"
      question="Campaign demand and fulfillment grouped by their authoritative time scope."
    >
      <WorkspaceData>
        {(summary) => {
          const campaign = summary.billing.campaign
          if (!campaign) {
            return (
              <WorkspaceSourceState
                title="Campaign aggregate unavailable"
                detail="HonestFit loaded, but the campaign contract was absent or malformed."
                tone="warning"
              />
            )
          }
          return (
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="mission-card p-5">
                <div className="mission-eyebrow">Lifetime</div>
                <EvidenceRow label="Purchase records" value={campaign.purchaseRecords} />
              </section>
              <section className="mission-card p-5">
                <div className="mission-eyebrow">Rolling 24 hours</div>
                <EvidenceRow label="Payments" value={campaign.payments24h} />
                <EvidenceRow label="Activations" value={campaign.activations24h} />
                <EvidenceRow label="Failures" value={campaign.paymentFailures24h + campaign.activationFailures24h} />
              </section>
              <section className="mission-card p-5">
                <div className="mission-eyebrow">Current state</div>
                <EvidenceRow label="Active campaigns" value={campaign.active} />
                <EvidenceRow label="Manual review" value={campaign.manualReview} />
                <EvidenceRow label="Refunded or disputed" value={campaign.refunded + campaign.disputed} />
              </section>
            </div>
          )
        }}
      </WorkspaceData>
    </MissionWorkspacePage>
  )
}

export function OperationsFoundation() {
  return (
    <MissionWorkspacePage
      eyebrow="Operations"
      title="Is HonestFit functioning reliably?"
      question="Sanitized subsystem health and active incidents, with Sentry retained as technical authority."
    >
      <WorkspaceData>
        {(summary) => {
          const incidents = openIncidents(summary)
          if (!summary.errors.subsystems) {
            return (
              <WorkspaceSourceState
                title="Incident contract unavailable"
                detail="Aggregate error totals remain available, but subsystem and incident detail could not be parsed."
                tone="warning"
              />
            )
          }
          return (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <section className="mission-card p-5">
                <h2 className="text-lg font-semibold text-mission-ink">Subsystems</h2>
                <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
                  {Object.entries(summary.errors.subsystems).map(([category, subsystem]) => (
                    <EvidenceRow
                      key={category}
                      label={category.replaceAll('_', ' ')}
                      value={subsystem.status === 'ok' ? 'Healthy' : 'Degraded'}
                      scope={`${subsystem.occurrences24h} occurrences in 24h`}
                    />
                  ))}
                </div>
              </section>
              <section className="mission-card p-5">
                <div className="mission-eyebrow">Active exceptions</div>
                <div className="mt-3 text-3xl font-semibold text-mission-ink">{incidents.length}</div>
                <p className="mission-meta mt-1">Sanitized incidents requiring review or monitoring.</p>
              </section>
            </div>
          )
        }}
      </WorkspaceData>
    </MissionWorkspacePage>
  )
}

export function FeedbackFoundation() {
  return (
    <MissionWorkspacePage
      eyebrow="Feedback"
      title="What are users telling us?"
      question="Read-only, deterministic feedback summaries with no raw voluntary text."
    >
      <WorkspaceData>
        {(summary) => {
          if (summary.contract.feedback !== 'available' || !summary.feedback) {
            return (
              <WorkspaceSourceState
                title="Feedback reporting is not yet available"
                detail="Feedback reporting is ready in HonestFit but is not yet available from the deployed production contract."
                tone="warning"
              />
            )
          }
          if (summary.feedback.items.length === 0) {
            return (
              <section className="mission-card p-6 text-center">
                <CircleSlash2 className="mx-auto h-6 w-6 text-mission-muted" aria-hidden="true" />
                <h2 className="mt-3 text-lg font-semibold text-mission-ink">No feedback has been submitted yet.</h2>
                <p className="mission-meta mt-1">The protected feedback contract is available and returned no items.</p>
              </section>
            )
          }
          return (
            <section className="mission-card divide-y divide-mission-border">
              {summary.feedback.items.slice(0, 5).map((item) => (
                <article key={item.reference} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-mission-ink">{item.summary}</h2>
                    <span className="text-xs font-semibold uppercase tracking-wide text-mission-muted">{item.status}</span>
                  </div>
                  <p className="mission-meta mt-1">{item.workspace.replaceAll('_', ' ')} · {formattedTimestamp(item.createdAt)}</p>
                </article>
              ))}
            </section>
          )
        }}
      </WorkspaceData>
    </MissionWorkspacePage>
  )
}
