import type { HonestFitMissionSummary } from '@/server/honestFitMissionSummary'

export type MissionOperationalState = 'healthy' | 'watch' | 'attention'

export type TodayAttentionItem = {
  id: string
  priority: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  action: string
  href: '/operations' | '/revenue' | '/feedback' | '/product'
}

export function missionOperationalState(
  summary: HonestFitMissionSummary,
): MissionOperationalState {
  const activeCritical = summary.errors.incidents.some(
    (incident) =>
      incident.status !== 'resolved' && incident.severity === 'critical',
  )
  const activeIncident = summary.errors.incidents.some(
    (incident) => incident.status !== 'resolved',
  )
  const degradedSubsystem = summary.errors.subsystems
    ? Object.values(summary.errors.subsystems).some(
        (subsystem) => subsystem.status === 'degraded',
      )
    : false

  if (
    summary.health.status === 'degraded' ||
    summary.health.blockingIssueCount > 0 ||
    activeCritical
  ) {
    return 'attention'
  }
  if (
    summary.health.warningCount > 0 ||
    summary.errors.critical24h > 0 ||
    activeIncident ||
    degradedSubsystem
  ) {
    return 'watch'
  }
  return 'healthy'
}

export function openIncidents(summary: HonestFitMissionSummary) {
  return summary.errors.incidents.filter(
    (incident) => incident.status !== 'resolved',
  )
}

export function unreadFeedbackCount(summary: HonestFitMissionSummary) {
  if (!summary.feedback) return null
  return summary.feedback.counts.new
}

export function formattedTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown update time'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function todayAttentionItems(
  summary: HonestFitMissionSummary,
): TodayAttentionItem[] {
  const incidents = openIncidents(summary)
  const campaign = summary.billing.campaign
  const sourceDegraded =
    summary.errors.subsystems?.source_processing.status === 'degraded'
  const sourceIncident = incidents.some(
    (incident) => incident.category === 'source_processing',
  )
  const unread = unreadFeedbackCount(summary)
  const items: TodayAttentionItem[] = []

  const criticalIncidents = incidents.filter(
    (incident) => incident.severity === 'critical',
  )
  if (criticalIncidents.length > 0) {
    items.push({
      id: 'critical-incidents',
      priority: 'critical',
      title: `${criticalIncidents.length} critical ${criticalIncidents.length === 1 ? 'incident' : 'incidents'}`,
      detail: 'Sanitized production incidents are open and require technical triage.',
      action: 'Review incidents',
      href: '/operations',
    })
  } else if (incidents.length > 0) {
    items.push({
      id: 'active-incidents',
      priority: 'warning',
      title: `${incidents.length} active ${incidents.length === 1 ? 'incident' : 'incidents'}`,
      detail: 'Open or monitoring incidents remain within the protected operational boundary.',
      action: 'Review operations',
      href: '/operations',
    })
  } else if (summary.contract.incidents !== 'available') {
    items.push({
      id: 'incident-contract',
      priority: 'warning',
      title: 'Incident detail unavailable',
      detail: 'Aggregate error totals loaded, but the sanitized incident contract did not.',
      action: 'Review source status',
      href: '/operations',
    })
  }

  if (campaign) {
    const paymentProblems =
      campaign.paymentFailures24h + campaign.activationFailures24h
    if (paymentProblems > 0) {
      items.push({
        id: 'campaign-failures',
        priority: 'critical',
        title: `${paymentProblems} payment or activation ${paymentProblems === 1 ? 'failure' : 'failures'}`,
        detail: 'Rolling-24-hour campaign fulfillment needs operator review.',
        action: 'Review campaign health',
        href: '/revenue',
      })
    }
  }

  if (sourceDegraded && !sourceIncident) {
    items.push({
      id: 'source-processing',
      priority: 'warning',
      title: 'Source processing is degraded',
      detail: 'The authoritative subsystem aggregate reports source-processing degradation.',
      action: 'Inspect source health',
      href: '/operations',
    })
  }

  if (unread != null && unread > 0) {
    items.push({
      id: 'unread-feedback',
      priority: 'info',
      title: `${unread} unread feedback ${unread === 1 ? 'item' : 'items'}`,
      detail: 'Read-only, deterministic summaries are available for operator review.',
      action: 'Read feedback',
      href: '/feedback',
    })
  }

  const previousViews = summary.previous?.traffic?.pageViews24h
  if (
    previousViews != null &&
    previousViews >= 5 &&
    summary.traffic.pageViews24h <= previousViews * 0.5
  ) {
    items.push({
      id: 'traffic-drop',
      priority: 'info',
      title: 'Traffic is materially lower',
      detail: `Observed page-view events fell from ${previousViews} to ${summary.traffic.pageViews24h} across comparable 24-hour windows.`,
      action: 'Review product signals',
      href: '/product',
    })
  }

  const rank = { critical: 0, warning: 1, info: 2 }
  return items
    .sort((left, right) => rank[left.priority] - rank[right.priority])
    .slice(0, 3)
}
