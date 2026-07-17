import { AlertTriangle, CheckCircle2, Clock3, Info } from 'lucide-react'
import { MissionWorkspacePage, WorkspaceSourceState } from './MissionWorkspacePage'
import { useHonestFitMissionSummary } from './useHonestFitMissionSummary'
import { formattedTimestamp } from './missionViewModel'
import { revenueState, revenueStateCopy } from './productRevenueModel'
import type { HonestFitMissionSummary } from '@/server/honestFitMissionSummary'

export function RevenueWorkspace() {
  const query = useHonestFitMissionSummary()
  return (
    <MissionWorkspacePage
      eyebrow="Revenue"
      title="Is the Job Search Campaign selling and activating correctly?"
      question="Campaign demand and fulfillment grouped by authoritative time scope, without cross-scope conversion math."
    >
      {query.isLoading ? (
        <WorkspaceSourceState title="Loading campaign authority" detail="Reading protected campaign and webhook aggregates." />
      ) : query.error || !query.data || query.data.status === 'error' ? (
        <WorkspaceSourceState title="HonestFit source failed" detail="Revenue authority could not be read. No healthy or zero-demand state is inferred." tone="critical" />
      ) : query.data.status === 'unavailable' ? (
        <WorkspaceSourceState title="HonestFit source unavailable" detail={query.data.message} tone="warning" />
      ) : (
        <RevenueSummary summary={query.data.summary} />
      )}
    </MissionWorkspacePage>
  )
}

export function RevenueSummary({ summary }: Readonly<{ summary: HonestFitMissionSummary }>) {
  const state = revenueState(summary)
  const copy = revenueStateCopy[state]
  const campaign = summary.billing.campaign
  const StateIcon = copy.tone === 'healthy' ? CheckCircle2 : AlertTriangle
  const tone =
    copy.tone === 'healthy'
      ? 'border-l-emerald-600'
      : copy.tone === 'warning'
        ? 'border-l-amber-600'
        : 'border-l-red-700'

  if (!campaign) {
    return (
      <div className="space-y-4">
        <WorkspaceSourceState title={copy.title} detail={copy.detail} tone="warning" />
        <section className="mission-card p-5">
          <h2 className="text-lg font-semibold text-mission-ink">Checkout availability is unknown</h2>
          <p className="mission-meta mt-1">HonestFit loaded without a usable campaign aggregate. Mission does not display this as zero purchases.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className={`mission-card border-l-4 p-5 sm:p-6 ${tone}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <StateIcon className={`mt-0.5 h-6 w-6 shrink-0 ${copy.tone === 'healthy' ? 'text-emerald-700' : copy.tone === 'warning' ? 'text-amber-700' : 'text-red-800'}`} aria-hidden="true" />
            <div>
              <div className="mission-eyebrow">Campaign state</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-mission-ink">{copy.title}</h2>
              <p className="mission-meta mt-1 max-w-2xl">{copy.detail}</p>
            </div>
          </div>
          <div className="rounded-lg border border-mission-border bg-mission-canvas px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mission-muted">
            {summary.contract.campaign === 'declared' ? 'Scopes declared upstream' : 'Legacy production · scopes normalized'}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <ScopeGroup title="Lifetime" scope="Campaign purchase-record authority">
          <RevenueMetric label="Purchase records" value={campaign.purchaseRecords} detail={campaign.purchaseRecords === 0 ? 'Zero purchase records observed' : 'Authoritative lifetime records'} />
          <UnavailableMetric label="Completed purchases" detail="Lifetime completion count is not supplied" />
        </ScopeGroup>

        <ScopeGroup title="Rolling 24 hours" scope="Recent campaign activity">
          <RevenueMetric label="Checkout sessions" value={campaign.checkoutSessions24h} detail={zeroObserved(campaign.checkoutSessions24h)} />
          <RevenueMetric label="Payments" value={campaign.payments24h} detail={zeroObserved(campaign.payments24h)} />
          <RevenueMetric label="Payment failures" value={campaign.paymentFailures24h} detail={zeroObserved(campaign.paymentFailures24h)} warning={campaign.paymentFailures24h > 0} />
          <RevenueMetric label="Activations" value={campaign.activations24h} detail={zeroObserved(campaign.activations24h)} />
          <RevenueMetric label="Activation failures" value={campaign.activationFailures24h} detail={zeroObserved(campaign.activationFailures24h)} warning={campaign.activationFailures24h > 0} />
        </ScopeGroup>

        <ScopeGroup title="Current state" scope="Campaign records right now">
          <RevenueMetric label="Active campaigns" value={campaign.active} detail="Current authoritative state" />
          <RevenueMetric label="Manual review" value={campaign.manualReview} detail="Current authoritative state" warning={campaign.manualReview > 0} />
          <RevenueMetric label="Refunded" value={campaign.refunded} detail="Current authoritative state" warning={campaign.refunded > 0} />
          <RevenueMetric label="Disputed" value={campaign.disputed} detail="Current authoritative state" warning={campaign.disputed > 0} />
          <RevenueMetric label="Expired" value={campaign.expired} detail="Current authoritative state" />
        </ScopeGroup>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="mission-card p-5" aria-labelledby="revenue-webhooks">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-mission-cobalt" aria-hidden="true" />
            <div>
              <div className="mission-eyebrow">Rolling 24 hours</div>
              <h2 id="revenue-webhooks" className="mt-2 text-lg font-semibold text-mission-ink">Stripe webhook processing</h2>
            </div>
          </div>
          <div className="mt-4 divide-y divide-mission-border">
            <RevenueMetric label="Webhook events" value={summary.billing.stripeWebhookEvents24h} detail={zeroObserved(summary.billing.stripeWebhookEvents24h)} />
            <RevenueMetric label="Webhook failures" value={summary.billing.stripeWebhookFailures24h} detail={zeroObserved(summary.billing.stripeWebhookFailures24h)} warning={summary.billing.stripeWebhookFailures24h > 0} />
          </div>
          <p className="mission-meta mt-4">Last observed webhook: {summary.billing.lastStripeWebhookAt ? formattedTimestamp(summary.billing.lastStripeWebhookAt) : 'Unavailable'}</p>
        </section>

        <section className="mission-card p-5" aria-labelledby="revenue-demand">
          <div className="mission-eyebrow">Rolling 24 hours</div>
          <h2 id="revenue-demand" className="mt-2 text-lg font-semibold text-mission-ink">Demand context</h2>
          <div className="mt-4 divide-y divide-mission-border">
            <RevenueMetric label="View-plans CTA events" value={summary.marketing.cta24h.viewPlansClicks} detail={zeroObserved(summary.marketing.cta24h.viewPlansClicks)} />
            <RevenueMetric label="Checkout-session events" value={campaign.checkoutSessions24h} detail={zeroObserved(campaign.checkoutSessions24h)} />
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
            <Info className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
            These differently sourced event counts are shown side by side, not combined into a conversion ratio.
          </div>
        </section>
      </div>

      <p className="text-xs leading-5 text-mission-muted">Custom campaign “since” windows are unsupported. Mission sends no `since` parameter and displays no “since posted” label.</p>
    </div>
  )
}

function ScopeGroup({ title, scope, children }: Readonly<{ title: string; scope: string; children: React.ReactNode }>) {
  return (
    <section className="mission-card p-5" aria-label={`${title}: ${scope}`}>
      <div className="mission-eyebrow">{title}</div>
      <h2 className="mt-2 text-lg font-semibold text-mission-ink">{scope}</h2>
      <div className="mt-4 divide-y divide-mission-border">{children}</div>
    </section>
  )
}

function RevenueMetric({ label, value, detail, warning = false }: Readonly<{ label: string; value: number; detail: string; warning?: boolean }>) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div>
        <div className="text-sm font-medium text-mission-ink">{label}</div>
        <div className={`mt-0.5 text-xs leading-5 ${warning ? 'font-semibold text-red-800' : 'text-mission-muted'}`}>{detail}</div>
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${warning ? 'text-red-800' : 'text-mission-ink'}`}>{value}</div>
    </div>
  )
}

function UnavailableMetric({ label, detail }: Readonly<{ label: string; detail: string }>) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div>
        <div className="text-sm font-medium text-mission-ink">{label}</div>
        <div className="mission-meta mt-0.5">{detail}</div>
      </div>
      <div className="text-sm font-semibold text-mission-muted">Unavailable</div>
    </div>
  )
}

function zeroObserved(value: number) {
  return value === 0 ? 'Zero observed events' : 'Observed aggregate events'
}
