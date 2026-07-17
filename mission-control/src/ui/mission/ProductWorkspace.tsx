import { Activity, CircleSlash2, Info } from 'lucide-react'
import { MissionWorkspacePage, WorkspaceSourceState } from './MissionWorkspacePage'
import { useHonestFitMissionSummary } from './useHonestFitMissionSummary'
import { productJourneyNarrative } from './productRevenueModel'
import type { HonestFitMissionSummary } from '@/server/honestFitMissionSummary'

type Metric = { label: string; value: number; context?: string }

const evidenceLabels = {
  uniqueUsers: 'Unique users',
  cohorts: 'Cohorts',
  firstReviewedStory: 'First reviewed story',
  firstApplicationKit: 'First Application Kit',
  practiceEntry: 'Practice entry',
  returnActivity: 'Return activity',
  retention: 'Retention',
} as const

export function ProductWorkspace() {
  const query = useHonestFitMissionSummary()
  return (
    <MissionWorkspacePage
      eyebrow="Product"
      title="Are users reaching value?"
      question="A truthful event-count journey, with unavailable people and retention evidence kept explicit."
    >
      {query.isLoading ? (
        <WorkspaceSourceState title="Loading product evidence" detail="Reading aggregate journey events and declared evidence semantics." />
      ) : query.error || !query.data || query.data.status === 'error' ? (
        <WorkspaceSourceState title="HonestFit source failed" detail="Product evidence could not be read. No zero values are fabricated." tone="critical" />
      ) : query.data.status === 'unavailable' ? (
        <WorkspaceSourceState title="HonestFit source unavailable" detail={query.data.message} tone="warning" />
      ) : (
        <ProductSummary summary={query.data.summary} />
      )}
    </MissionWorkspacePage>
  )
}

export function ProductSummary({ summary }: Readonly<{ summary: HonestFitMissionSummary }>) {
  const groups: Array<{ title: string; question: string; metrics: Metric[] }> = [
    {
      title: 'Interest',
      question: 'Are people showing intent?',
      metrics: [
        { label: 'Homepage and pricing page views', value: summary.traffic.pageViews24h },
        { label: 'Career Memory CTA clicks', value: summary.marketing.cta24h.getStartedClicks },
        { label: 'Sign-in CTA clicks', value: summary.marketing.cta24h.signInClicks },
        { label: 'View-plans CTA clicks', value: summary.marketing.cta24h.viewPlansClicks },
      ],
    },
    {
      title: 'Account access',
      question: 'Are account entry events progressing?',
      metrics: [
        { label: 'Magic links requested', value: summary.funnel.magicLinksRequested24h },
        { label: 'Magic links consumed', value: summary.funnel.magicLinksConsumed24h },
        { label: 'Free signup events', value: summary.signups.free24h },
      ],
    },
    {
      title: 'Career Memory and source activity',
      question: 'Are capture and source events occurring?',
      metrics: [
        { label: 'Profile views', value: summary.funnel.profileViews24h },
        { label: 'Story capture started', value: summary.funnel.captureStarted24h },
        { label: 'Story capture saved', value: summary.funnel.captureSaved24h },
      ],
    },
    {
      title: 'Fit and output activity',
      question: 'Are downstream value events occurring?',
      metrics: [
        { label: 'Fit workspace views', value: summary.funnel.fitViewed24h },
        { label: 'Fit report requests', value: summary.funnel.fitReportsRequested24h },
        { label: 'Resume generation events', value: summary.funnel.resumeGenerated24h },
      ],
    },
  ]

  return (
    <div className="space-y-5">
      <section className="mission-card border-l-4 border-l-mission-cobalt p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mission-eyebrow">Journey interpretation</div>
            <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-mission-ink">{productJourneyNarrative(summary)}</h2>
            <p className="mission-meta mt-2">All displayed activity is scoped to rolling 24-hour aggregate events unless explicitly labeled otherwise.</p>
          </div>
          <span className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-950">
            <Activity className="h-4 w-4" aria-hidden="true" />
            Event counts only
          </span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title} className="mission-card p-5" aria-labelledby={`product-${group.title.replaceAll(' ', '-').toLowerCase()}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id={`product-${group.title.replaceAll(' ', '-').toLowerCase()}`} className="text-lg font-semibold text-mission-ink">{group.title}</h2>
                <p className="mission-meta mt-1">{group.question}</p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Event counts only</span>
            </div>
            <div className="mt-4 divide-y divide-mission-border">
              {group.metrics.map((metric) => (
                <div key={metric.label} className="flex min-h-14 items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium text-mission-ink">{metric.label}</div>
                    <div className="mission-meta mt-0.5">{metric.value === 0 ? 'Zero observed events' : 'Observed aggregate events'}</div>
                  </div>
                  <div className="text-2xl font-semibold tabular-nums text-mission-ink">{metric.value}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mission-card p-5 sm:p-6" aria-labelledby="product-unavailable">
        <div className="flex items-start gap-3">
          <CircleSlash2 className="mt-0.5 h-5 w-5 shrink-0 text-mission-muted" aria-hidden="true" />
          <div>
            <div className="mission-eyebrow">Evidence limitations</div>
            <h2 id="product-unavailable" className="mt-2 text-xl font-semibold text-mission-ink">People, milestones, and retention are not currently measurable</h2>
          </div>
        </div>
        <div className="mt-5 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(evidenceLabels).map(([key, label]) => {
            const evidence = summary.productEvidence[key as keyof typeof evidenceLabels]
            const unavailable = evidence.availability === 'unavailable'
            const wording =
              evidence.availability === 'insufficient_volume'
                ? 'Insufficient volume'
                : unavailable
                  ? 'Unavailable · not instrumented'
                  : 'Unsupported by current evidence'
            return (
              <div key={key} className="min-h-16 border-b border-mission-border py-3">
                <div className="text-sm font-semibold text-mission-ink">{label}</div>
                <div className="mission-meta mt-0.5">{wording}</div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
          <Info className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
          Mission does not divide event totals, deduplicate incomplete keys, or treat sessions as people.
        </div>
      </section>
    </div>
  )
}
