import { AlertTriangle, CheckCircle2, CircleDashed, RefreshCw } from 'lucide-react'
import { useHonestFitMissionSummary } from './useHonestFitMissionSummary'
import {
  formattedTimestamp,
  missionOperationalState,
  openIncidents,
  unreadFeedbackCount,
} from './missionViewModel'

export function HonestFitGlobalHeader() {
  const query = useHonestFitMissionSummary()
  const result = query.data

  if (query.isLoading) {
    return (
      <div className="border-b border-mission-border bg-mission-surface px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 text-sm text-mission-muted">
          <CircleDashed className="h-4 w-4" aria-hidden="true" />
          Checking HonestFit production…
        </div>
      </div>
    )
  }

  if (query.error || !result || result.status !== 'success') {
    const unavailable = result?.status === 'unavailable'
    return (
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2 text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold">HonestFit source unavailable</div>
              <div className="text-xs leading-5 text-amber-900/80">
                {unavailable ? result.message : 'Mission could not read the protected summary.'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 text-sm font-semibold text-amber-950 hover:bg-amber-100"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  const summary = result.summary
  const state = missionOperationalState(summary)
  const incidents = openIncidents(summary)
  const unread = unreadFeedbackCount(summary)
  const stateLabel =
    state === 'healthy' ? 'Operating normally' : state === 'watch' ? 'Watch closely' : 'Needs attention'
  const tone =
    state === 'healthy'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
      : state === 'watch'
        ? 'border-amber-300 bg-amber-50 text-amber-950'
        : 'border-red-300 bg-red-50 text-red-950'
  const Icon = state === 'healthy' ? CheckCircle2 : AlertTriangle

  return (
    <div className={`border-b px-4 py-3 sm:px-6 ${tone}`}>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <div className="text-sm font-semibold">HonestFit · {stateLabel}</div>
            <div className="text-xs leading-5 opacity-75">
              {incidents.length} active {incidents.length === 1 ? 'incident' : 'incidents'} ·{' '}
              {unread == null ? 'feedback contract pending deployment' : `${unread} unread feedback`} ·{' '}
              updated {formattedTimestamp(summary.generatedAt)}
            </div>
          </div>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide opacity-75">
          Production · Read only
        </div>
      </div>
    </div>
  )
}
