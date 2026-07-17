import type { HonestFitMissionSummary } from '@/server/honestFitMissionSummary'

export type MissionOperationalState = 'healthy' | 'watch' | 'attention'

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
