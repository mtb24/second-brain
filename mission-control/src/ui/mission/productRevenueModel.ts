import type { HonestFitMissionSummary } from '@/server/honestFitMissionSummary'

export type RevenueState =
  | 'source_unavailable'
  | 'payment_failure'
  | 'activation_failure'
  | 'webhook_failure'
  | 'stale_webhook'
  | 'manual_review'
  | 'healthy_no_demand'
  | 'healthy_activity'

export function productJourneyNarrative(summary: HonestFitMissionSummary) {
  const total =
    summary.traffic.pageViews24h +
    summary.marketing.cta24h.getStartedClicks +
    summary.marketing.cta24h.signInClicks +
    summary.funnel.magicLinksRequested24h +
    summary.funnel.captureStarted24h +
    summary.funnel.captureSaved24h +
    summary.funnel.fitViewed24h +
    summary.funnel.fitReportsRequested24h +
    summary.funnel.resumeGenerated24h

  return total === 0
    ? 'No journey events were observed in the current 24-hour window. Unique-user and retention evidence remain unavailable.'
    : 'Interest is visible in aggregate events, but unique-user conversion and return activity are not measurable.'
}

export function revenueState(summary: HonestFitMissionSummary): RevenueState {
  const campaign = summary.billing.campaign
  if (!campaign) return 'source_unavailable'
  if (campaign.paymentFailures24h > 0) return 'payment_failure'
  if (campaign.activationFailures24h > 0) return 'activation_failure'
  if (summary.billing.stripeWebhookFailures24h > 0) return 'webhook_failure'
  if (campaign.manualReview > 0) return 'manual_review'

  const hasRecentActivity =
    campaign.checkoutSessions24h + campaign.payments24h + campaign.activations24h > 0
  if (hasRecentActivity) {
    const generatedAt = Date.parse(summary.generatedAt)
    const lastWebhookAt = summary.billing.lastStripeWebhookAt
      ? Date.parse(summary.billing.lastStripeWebhookAt)
      : Number.NaN
    const stale =
      Number.isNaN(lastWebhookAt) ||
      generatedAt - lastWebhookAt > 24 * 60 * 60 * 1000
    if (stale) return 'stale_webhook'
  }

  return hasRecentActivity ? 'healthy_activity' : 'healthy_no_demand'
}

export const revenueStateCopy: Record<
  RevenueState,
  { title: string; detail: string; tone: 'healthy' | 'warning' | 'critical' }
> = {
  source_unavailable: {
    title: 'Campaign aggregate unavailable',
    detail: 'Checkout health and demand cannot be determined from the protected source.',
    tone: 'warning',
  },
  payment_failure: {
    title: 'Payment failures need review',
    detail: 'At least one payment failure was observed in the rolling 24-hour campaign window.',
    tone: 'critical',
  },
  activation_failure: {
    title: 'Activation failures need review',
    detail: 'Payment and entitlement activation are not completing together reliably.',
    tone: 'critical',
  },
  webhook_failure: {
    title: 'Stripe webhook processing is degraded',
    detail: 'Webhook failure events were observed in the rolling 24-hour window.',
    tone: 'critical',
  },
  stale_webhook: {
    title: 'Webhook evidence may be stale',
    detail: 'Campaign activity is present without a webhook timestamp inside the comparable 24-hour window.',
    tone: 'warning',
  },
  manual_review: {
    title: 'Campaign records need manual review',
    detail: 'The current campaign state includes records explicitly held for operator review.',
    tone: 'warning',
  },
  healthy_no_demand: {
    title: 'Checkout is healthy; no recent demand observed',
    detail: 'Zero checkout, payment, and activation events were observed in the rolling 24-hour window, with no failure evidence.',
    tone: 'healthy',
  },
  healthy_activity: {
    title: 'Campaign selling and activation appear healthy',
    detail: 'Recent payment and activation evidence has no declared failure or stale-webhook signal.',
    tone: 'healthy',
  },
}
