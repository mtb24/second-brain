import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash2,
  Info,
  MessageSquareText,
  Paperclip,
} from 'lucide-react'
import { MissionWorkspacePage, WorkspaceSourceState } from './MissionWorkspacePage'
import { useHonestFitMissionSummary } from './useHonestFitMissionSummary'
import { formattedTimestamp } from './missionViewModel'
import type {
  HonestFitFeedbackItem,
  HonestFitMissionSummary,
} from '@/server/honestFitMissionSummary'

const categoryLabels = {
  idea: 'Idea',
  problem: 'Problem',
  confusing: 'Confusing',
  other: 'Other',
} as const

const statusLabels = {
  new: 'New',
  reviewed: 'Reviewed',
  closed: 'Closed',
} as const

const workspaceLabels: Record<HonestFitFeedbackItem['workspace'], string> = {
  career_memory: 'Career Memory',
  application_kit: 'Application Kit',
  practice: 'Practice',
  story_inbox: 'Story Inbox',
  story_capture: 'Story capture',
  account: 'Account',
  settings: 'Settings',
  profile: 'Profile',
  public_profile: 'Public profile',
  other: 'Other',
  unknown: 'Unknown workspace',
}

export function FeedbackWorkspace() {
  const query = useHonestFitMissionSummary()
  return (
    <MissionWorkspacePage
      eyebrow="Feedback"
      title="What are users telling us?"
      question="A bounded, read-only operator projection using only deterministic HonestFit summaries."
    >
      {query.isLoading ? (
        <WorkspaceSourceState title="Loading feedback reporting" detail="Reading the protected aggregate summary." />
      ) : query.error || !query.data || query.data.status === 'error' ? (
        <WorkspaceSourceState
          title="HonestFit source failed"
          detail="Feedback and the shared HonestFit source could not be read. Mission does not represent this as no feedback."
          tone="critical"
        />
      ) : query.data.status === 'unavailable' ? (
        <WorkspaceSourceState
          title="HonestFit source unavailable"
          detail="The protected HonestFit source is unavailable. Feedback state is unknown."
          tone="warning"
        />
      ) : (
        <FeedbackSummary summary={query.data.summary} />
      )}
    </MissionWorkspacePage>
  )
}

export function FeedbackSummary({ summary }: Readonly<{ summary: HonestFitMissionSummary }>) {
  if (summary.contract.feedback === 'unavailable') {
    return (
      <div className="space-y-4">
        <WorkspaceSourceState
          title="Feedback reporting is not yet available"
          detail="Feedback reporting is ready in HonestFit but is not yet available from the deployed production contract."
          tone="warning"
        />
        <FeedbackPrivacyBoundary />
      </div>
    )
  }

  if (summary.contract.feedback === 'malformed' || !summary.feedback) {
    return (
      <div className="space-y-4">
        <WorkspaceSourceState
          title="Feedback source is partial"
          detail="The shared HonestFit summary loaded, but its feedback projection could not be validated. Other workspaces remain available; no empty queue is fabricated."
          tone="critical"
        />
        <FeedbackPrivacyBoundary />
      </div>
    )
  }

  const feedback = summary.feedback
  const unread = feedback.counts.new

  return (
    <div className="space-y-5">
      <section className="mission-card p-5 sm:p-6" aria-labelledby="feedback-overview">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <MessageSquareText className="mt-0.5 h-6 w-6 shrink-0 text-mission-cobalt" aria-hidden="true" />
            <div>
              <div className="mission-eyebrow">Read-only queue</div>
              <h2 id="feedback-overview" className="mt-2 text-2xl font-semibold tracking-tight text-mission-ink">
                {unread === 0 ? 'No unread feedback' : `${unread} unread feedback ${unread === 1 ? 'item' : 'items'}`}
              </h2>
              <p className="mission-meta mt-1">Newest first · controlled summaries only · no mutation controls</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Count label="New" value={feedback.counts.new} />
            <Count label="Reviewed" value={feedback.counts.reviewed} />
            <Count label="Closed" value={feedback.counts.closed} />
          </div>
        </div>
      </section>

      {feedback.items.length === 0 ? (
        <section className="mission-card p-7 text-center">
          <CircleSlash2 className="mx-auto h-7 w-7 text-mission-muted" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-semibold text-mission-ink">No feedback has been submitted yet.</h2>
          <p className="mission-meta mx-auto mt-1 max-w-xl">The protected feedback contract is available and returned no items. This is distinct from an unavailable contract.</p>
        </section>
      ) : (
        <section aria-labelledby="feedback-items">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="mission-eyebrow">Operator summaries</div>
              <h2 id="feedback-items" className="mt-2 text-xl font-semibold text-mission-ink">Newest feedback</h2>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-mission-muted">{feedback.items.length} returned</span>
          </div>
          <div className="space-y-3">
            {feedback.items.map((item) => (
              <article key={item.reference} className={`mission-card p-5 sm:p-6 ${item.unread ? 'border-l-4 border-l-mission-gold' : ''}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-mission-border bg-mission-canvas px-2.5 py-1 text-xs font-semibold text-mission-ink">{categoryLabels[item.category]}</span>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-950">{statusLabels[item.status]}</span>
                      {item.unread ? <span className="text-xs font-semibold uppercase tracking-wide text-amber-900">Unread</span> : null}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-mission-ink">{item.summary}</h3>
                    <p className="mission-meta mt-1">{workspaceLabels[item.workspace]} · {formattedTimestamp(item.createdAt)}</p>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-semibold text-mission-muted">{item.reference}</span>
                </div>
                <dl className="mt-5 grid gap-3 border-t border-mission-border pt-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Normalized route</dt>
                    <dd className="mt-1 break-words font-mono text-xs font-semibold text-mission-ink">{item.route ?? 'No route context supplied'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Optional context</dt>
                    <dd className="mt-1 flex items-center gap-2 text-sm font-semibold text-mission-ink">
                      {item.optionalContextProvided ? <Paperclip className="h-4 w-4" aria-hidden="true" /> : <Info className="h-4 w-4" aria-hidden="true" />}
                      {item.optionalContextProvided ? 'Technical context supplied' : 'No optional context supplied'}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}

      {feedback.hasMore ? (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950" role="status">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">More feedback exists outside this bounded result</h2>
            <p className="mt-1 text-sm leading-6 opacity-80">HonestFit returned the newest {feedback.query.limit} items and does not expose a cursor or raw-browsing path.</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <FeedbackPrivacyBoundary />
        <section className="mission-card p-5" aria-labelledby="feedback-statuses">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mission-cobalt" aria-hidden="true" />
            <div>
              <h2 id="feedback-statuses" className="font-semibold text-mission-ink">Authoritative statuses</h2>
              <p className="mission-meta mt-1">New, reviewed, and closed are displayed exactly as HonestFit provides them. Mission cannot change status.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Count({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="min-w-16 rounded-lg border border-mission-border bg-mission-canvas px-3 py-2">
      <div className="text-xl font-semibold tabular-nums text-mission-ink">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-mission-muted">{label}</div>
    </div>
  )
}

function FeedbackPrivacyBoundary() {
  return (
    <section className="mission-card p-5" aria-labelledby="feedback-privacy">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-mission-gold" aria-hidden="true" />
        <div>
          <h2 id="feedback-privacy" className="font-semibold text-mission-ink">Private message content stays in HonestFit</h2>
          <p className="mission-meta mt-1">Mission receives no raw feedback, identity, browser payload, career content, generated content, payment identifiers, or diagnostics.</p>
        </div>
      </div>
    </section>
  )
}
