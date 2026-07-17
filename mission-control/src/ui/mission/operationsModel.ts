import type {
  HonestFitIncidentCategory,
  HonestFitMissionSummary,
} from '@/server/honestFitMissionSummary'

export type OperationsCategory =
  | HonestFitIncidentCategory
  | 'deployment_release'
  | 'capacity'

export type OperationsSubsystemRow = {
  category: OperationsCategory
  label: string
  status: 'healthy' | 'degraded' | 'unavailable'
  occurrences24h: number | null
  detail: string
}

const labels: Record<OperationsCategory, string> = {
  application: 'Application',
  authentication: 'Authentication',
  source_processing: 'Source processing',
  billing_entitlement: 'Billing and entitlement',
  stripe_webhook: 'Stripe webhooks',
  voice: 'Voice',
  database: 'Database',
  deployment_release: 'Deployment and release',
  capacity: 'Capacity',
}

const incidentImpact: Record<HonestFitIncidentCategory, string> = {
  application: 'A production application path may not be completing reliably.',
  authentication: 'Account access or session establishment may be affected.',
  source_processing: 'Source ingestion or processing may be delayed or failing.',
  billing_entitlement: 'Paid access or entitlement state may not reconcile correctly.',
  stripe_webhook: 'Payment events may not be reaching campaign state promptly.',
  voice: 'Realtime or text practice availability may be degraded.',
  database: 'Authoritative reads or writes may be failing.',
}

const incidentAction: Record<HonestFitIncidentCategory, string> = {
  application: 'Open the sanitized Sentry event and confirm the affected route and build.',
  authentication: 'Confirm the authentication provider and session path in Sentry.',
  source_processing: 'Check the source-processing queue and the linked Sentry evidence.',
  billing_entitlement: 'Compare campaign authority with webhook health; do not mutate payment state here.',
  stripe_webhook: 'Review webhook delivery authority and the last processed event.',
  voice: 'Check the voice provider/runtime health without exposing session content.',
  database: 'Check database health and the affected build before attempting remediation.',
}

export function operationsSubsystemRows(
  summary: HonestFitMissionSummary,
): OperationsSubsystemRow[] {
  const contract = summary.errors.subsystems
  const declared = (
    [
      'application',
      'authentication',
      'source_processing',
      'billing_entitlement',
      'stripe_webhook',
      'voice',
      'database',
    ] as const
  ).map((category) => {
    const subsystem = contract?.[category]
    return {
      category,
      label: labels[category],
      status: subsystem
        ? subsystem.status === 'ok'
          ? ('healthy' as const)
          : ('degraded' as const)
        : ('unavailable' as const),
      occurrences24h: subsystem?.occurrences24h ?? null,
      detail: subsystem
        ? `${subsystem.occurrences24h} observed ${subsystem.occurrences24h === 1 ? 'occurrence' : 'occurrences'} in 24 hours`
        : 'Dedicated subsystem evidence unavailable',
    }
  })

  return [
    ...declared,
    {
      category: 'deployment_release',
      label: labels.deployment_release,
      status: 'unavailable',
      occurrences24h: null,
      detail: summary.health.appVersion
        ? `App version ${summary.health.appVersion}; no dedicated release-health measurement`
        : 'Dedicated release-health measurement unavailable',
    },
    {
      category: 'capacity',
      label: labels.capacity,
      status: 'unavailable',
      occurrences24h: null,
      detail: 'Capacity is not measured by the protected summary',
    },
  ]
}

export function incidentGuidance(category: HonestFitIncidentCategory) {
  return {
    impact: incidentImpact[category],
    action: incidentAction[category],
  }
}
