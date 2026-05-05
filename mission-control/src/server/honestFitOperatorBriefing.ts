import type { HonestFitMissionSummary } from './honestFitMissionSummary'

export type HonestFitOperatorBriefingStatus =
  | 'ok'
  | 'watch'
  | 'needs_attention'

export type HonestFitOperatorBriefing = {
  whatHappened: string[]
  whatChanged: string[]
  whereStuck: string[]
  needsAttention: string[]
  canIgnore: string[]
  status: HonestFitOperatorBriefingStatus
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function compareMetric(
  current: number,
  previous: number | undefined,
  label: string,
) {
  if (previous === undefined) return null
  if (current > previous) return `${label} increased from the previous window.`
  if (current < previous) return `${label} decreased from the previous window.`
  return `${label} is unchanged.`
}

function limitBullets(items: string[], max = 3) {
  return items.filter(Boolean).slice(0, max)
}

export function buildHonestFitOperatorBriefing(
  summary: HonestFitMissionSummary,
): HonestFitOperatorBriefing {
  const traffic = summary.traffic.classification
  const pageViews = traffic.estimatedReal
  const rawPageViews = traffic.raw
  const signInStarted = summary.funnel.magicLinksRequested24h
  const signedIn = summary.funnel.magicLinksConsumed24h
  const profileViewed = summary.funnel.profileViews24h
  const captureStarted = summary.funnel.captureStarted24h
  const captureSaved = summary.funnel.captureSaved24h
  const fitViewed = summary.funnel.fitViewed24h
  const fitReports = summary.funnel.fitReportsRequested24h
  const resumeGenerated = summary.funnel.resumeGenerated24h
  const proSignups = summary.signups.pro24h
  const errors = summary.errors.total24h
  const criticalErrors = summary.errors.critical24h
  const healthBlockers = summary.health.blockingIssueCount
  const webhookFailures = summary.billing.stripeWebhookFailures24h

  const hasSignInDropOff = signInStarted > 0 && signedIn === 0
  const hasCaptureDropOff = captureStarted > 0 && captureSaved === 0

  const needsAttention =
    healthBlockers > 0 || criticalErrors > 0 || webhookFailures > 0
  const watch =
    errors > 0 ||
    (pageViews > 0 && signInStarted === 0) ||
    hasSignInDropOff ||
    (profileViewed > 0 && captureStarted === 0) ||
    hasCaptureDropOff

  const whatHappened = [
    `${countLabel(
      pageViews,
      'estimated real page view',
    )} in the last 24 hours.`,
  ]
  if (rawPageViews !== pageViews) {
    whatHappened.push(
      `${countLabel(rawPageViews, 'raw page view')} before launch traffic classification.`,
    )
  }
  if (signInStarted > 0) {
    whatHappened.push(
      `${countLabel(signInStarted, 'person', 'people')} requested sign-in links.`,
    )
  }
  if (signedIn > 0) {
    whatHappened.push(`${countLabel(signedIn, 'user')} completed sign-in.`)
  }
  if (profileViewed > 0) {
    whatHappened.push(`${countLabel(profileViewed, 'user')} reached the profile.`)
  }
  if (captureStarted > 0 || captureSaved > 0) {
    whatHappened.push(
      `${countLabel(captureStarted, 'capture')} started; ${countLabel(
        captureSaved,
        'capture',
      )} saved.`,
    )
  }
  if (fitViewed > 0 || fitReports > 0 || resumeGenerated > 0) {
    whatHappened.push(
      `${countLabel(fitViewed, 'fit view')} with ${countLabel(
        fitReports + resumeGenerated,
        'fit/report action',
      )}.`,
    )
  }
  if (proSignups > 0) {
    whatHappened.push(`${countLabel(proSignups, 'new Pro signup')}.`)
  }

  const changeCandidates = [
    compareMetric(
      pageViews,
      summary.previous?.traffic?.pageViews24h,
      'Traffic',
    ),
    compareMetric(proSignups, summary.previous?.signups?.pro24h, 'Pro signups'),
    compareMetric(
      summary.billing.stripeWebhookEvents24h,
      summary.previous?.billing?.stripeWebhookEvents24h,
      'Stripe webhook activity',
    ),
  ].filter((item): item is string => Boolean(item))
  const whatChanged =
    changeCandidates.length > 0
      ? changeCandidates
      : ['No comparison window yet; watching the next refresh.']

  const whereStuck: string[] = []
  if (summary.funnelGraph?.insight) {
    whereStuck.push(summary.funnelGraph.insight)
  }
  if (pageViews > 0 && signInStarted === 0) {
    whereStuck.push(
      'Current launch signal is too low to diagnose conversion. Need more qualified traffic before changing product based on funnel numbers.',
    )
  }
  if (hasSignInDropOff) {
    whereStuck.push(
      'People requested sign-in links, but no one completed sign-in.',
    )
  }
  if (signedIn > 0 && profileViewed === 0) {
    whereStuck.push('Users signed in, but did not reach the profile.')
  }
  if (profileViewed > 0 && captureStarted === 0) {
    whereStuck.push('Users reached the profile, but no capture was started.')
  }
  if (hasCaptureDropOff) {
    whereStuck.push('Capture started, but nothing was saved.')
  }
  if (whereStuck.length === 0) {
    whereStuck.push('No obvious funnel drop-off yet.')
  }

  const actionItems = summary.ops?.actionItems?.filter(Boolean) ?? []
  const attentionItems =
    actionItems.length > 0
      ? actionItems
      : [
          healthBlockers > 0
            ? `Review health blockers: ${healthBlockers} active.`
            : '',
          criticalErrors > 0
            ? `Review critical errors: ${criticalErrors} in the last 24 hours.`
            : '',
          errors > 0
            ? `Review recent errors: ${errors} in the last 24 hours.`
            : '',
          webhookFailures > 0
            ? `Check Stripe webhook failures: ${webhookFailures} in the last 24 hours.`
            : '',
          hasSignInDropOff
            ? 'Check email delivery if sign-in requests continue without completions.'
            : '',
          hasCaptureDropOff
            ? 'Review capture flow if saves continue to lag starts.'
            : '',
        ]

  const needsAttentionBullets =
    attentionItems.filter(Boolean).length > 0
      ? attentionItems
      : ['No urgent action needed.']

  const canIgnore = [
    summary.health.status === 'ok' &&
    healthBlockers === 0 &&
    summary.health.warningCount === 0
      ? 'Health checks are clean.'
      : '',
    criticalErrors === 0 ? 'No critical errors.' : '',
    webhookFailures === 0 ? 'No Stripe webhook failures.' : '',
    summary.ops?.resendAlerts24h === 0 ? 'No Resend/email alerts.' : '',
  ]

  return {
    whatHappened: limitBullets(whatHappened),
    whatChanged: limitBullets(whatChanged),
    whereStuck: limitBullets(whereStuck),
    needsAttention: limitBullets(needsAttentionBullets),
    canIgnore: limitBullets(canIgnore),
    status: needsAttention ? 'needs_attention' : watch ? 'watch' : 'ok',
  }
}
