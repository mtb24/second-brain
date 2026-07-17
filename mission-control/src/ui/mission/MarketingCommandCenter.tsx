import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker } from '@tanstack/react-router'
import {
  ArrowRight,
  CalendarClock,
  Check,
  Clipboard,
  ExternalLink,
  Info,
  Lightbulb,
  Megaphone,
  RefreshCw,
  RotateCcw,
  Save,
  Signal,
} from 'lucide-react'
import { MissionWorkspacePage, WorkspaceSourceState } from './MissionWorkspacePage'
import { useHonestFitMissionSummary } from './useHonestFitMissionSummary'
import { formattedTimestamp } from './missionViewModel'
import type {
  HonestFitMarketingCampaign,
  HonestFitMarketingCampaignState,
  HonestFitMarketingCampaignStatus,
} from '@/lib/honestFitMarketingExperiment'
import type {
  HonestFitMissionSummary,
  HonestFitMissionSummaryResult,
} from '@/server/honestFitMissionSummary'

type CampaignEditFields = Pick<
  HonestFitMarketingCampaign,
  | 'title'
  | 'hook'
  | 'postBody'
  | 'audience'
  | 'hypothesis'
  | 'targetUrl'
  | 'suggestedScreenshot'
  | 'feedbackAsk'
>

type LearningFields = Pick<
  HonestFitMarketingCampaign,
  'learningWhatHappened' | 'learningWhatWasConfusing' | 'nextMessageAngle'
>

type MarketingCommandCenterViewProps = {
  summaryResult?: HonestFitMissionSummaryResult
  campaignState?: HonestFitMarketingCampaignState
  campaignLoading?: boolean
  summaryLoading?: boolean
  campaignError?: Error | null
  summaryError?: Error | null
  saveError?: Error | null
  isSaving?: boolean
  onRefresh?: () => void
  onMarkPosted?: (input: { campaignId: string; postedUrl: string }) => void
  onSaveLearning?: (input: LearningFields & { campaignId: string }) => void
  onUpdateCampaign?: (
    campaignId: string,
    campaign: Partial<CampaignEditFields>,
  ) => void
  onStartNextCampaign?: (draftId: string) => void
  onDirtyChange?: (dirty: boolean) => void
}

const queueGroups: ReadonlyArray<{
  label: string
  statuses: HonestFitMarketingCampaignStatus[]
}> = [
  { label: 'In progress', statuses: ['draft'] },
  { label: 'Prepared', statuses: ['ready'] },
  { label: 'Live / measuring', statuses: ['posted', 'waiting_for_data'] },
  { label: 'Learning captured', statuses: ['learning_captured'] },
  { label: 'Archived', statuses: ['archived'] },
]

async function fetchCampaignState(): Promise<HonestFitMarketingCampaignState> {
  const response = await fetch('/api/honestfit/marketing-experiment', {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Unable to load campaign storage')
  return response.json()
}

async function patchCampaignState(
  body: Record<string, unknown>,
): Promise<HonestFitMarketingCampaignState> {
  const response = await fetch('/api/honestfit/marketing-experiment', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('Unable to save campaign changes')
  return response.json()
}

export function MarketingCommandCenter() {
  const queryClient = useQueryClient()
  const [editorDirty, setEditorDirty] = useState(false)
  useBlocker({
    disabled: !editorDirty,
    enableBeforeUnload: editorDirty,
    shouldBlockFn: () =>
      !window.confirm(
        'Leave Marketing? Unsaved campaign changes will be lost.',
      ),
  })
  const campaignQuery = useQuery({
    queryKey: ['honestfit-marketing-experiment'],
    queryFn: fetchCampaignState,
  })
  const summaryQuery = useHonestFitMissionSummary()
  const mutation = useMutation({
    mutationFn: patchCampaignState,
    onSuccess: async (state) => {
      queryClient.setQueryData(['honestfit-marketing-experiment'], state)
      await queryClient.invalidateQueries({
        queryKey: ['honestfit-mission-summary'],
      })
    },
  })

  return (
    <MarketingCommandCenterView
      summaryResult={summaryQuery.data}
      campaignState={campaignQuery.data}
      campaignLoading={campaignQuery.isLoading}
      summaryLoading={summaryQuery.isLoading}
      campaignError={campaignQuery.error}
      summaryError={summaryQuery.error}
      saveError={mutation.error}
      isSaving={mutation.isPending}
      onDirtyChange={setEditorDirty}
      onRefresh={() => {
        void campaignQuery.refetch()
        void summaryQuery.refetch()
      }}
      onMarkPosted={({ campaignId, postedUrl }) =>
        mutation.mutate({ action: 'mark_posted', campaignId, postedUrl })
      }
      onSaveLearning={(learning) =>
        mutation.mutate({ action: 'save_learning', ...learning })
      }
      onUpdateCampaign={(campaignId, campaign) =>
        mutation.mutate({ action: 'update', campaignId, campaign })
      }
      onStartNextCampaign={(draftId) =>
        mutation.mutate({ action: 'start_next_campaign', draftId })
      }
    />
  )
}

export function MarketingCommandCenterView({
  summaryResult,
  campaignState,
  campaignLoading = false,
  summaryLoading = false,
  campaignError,
  summaryError,
  saveError,
  isSaving = false,
  onRefresh,
  onMarkPosted,
  onSaveLearning,
  onUpdateCampaign,
  onStartNextCampaign,
  onDirtyChange,
}: Readonly<MarketingCommandCenterViewProps>) {
  return (
    <MissionWorkspacePage
      eyebrow="Marketing"
      title="What should I publish or adjust next?"
      question="Campaign decisions, message production, publishing state, and learning in one command center."
    >
      {campaignLoading && !campaignState ? (
        <WorkspaceSourceState
          title="Loading campaign command center"
          detail="Reading the authenticated Mission campaign store."
        />
      ) : campaignError || !campaignState ? (
        <WorkspaceSourceState
          title="Campaign controls unavailable"
          detail="The campaign store could not be read. No draft, publishing state, or result is inferred."
          tone="critical"
        />
      ) : campaignState.campaigns.length === 0 ? (
        <WorkspaceSourceState
          title="No campaigns are configured"
          detail="Campaign storage is available, but it returned no prepared or active campaigns."
          tone="warning"
        />
      ) : (
        <CampaignCommandCenter
          summaryResult={summaryResult}
          summaryLoading={summaryLoading}
          summaryError={summaryError}
          state={campaignState}
          saveError={saveError}
          isSaving={isSaving}
          onRefresh={onRefresh}
          onMarkPosted={onMarkPosted}
          onSaveLearning={onSaveLearning}
          onUpdateCampaign={onUpdateCampaign}
          onStartNextCampaign={onStartNextCampaign}
          onDirtyChange={onDirtyChange}
        />
      )}
    </MissionWorkspacePage>
  )
}

function CampaignCommandCenter({
  summaryResult,
  summaryLoading,
  summaryError,
  state,
  saveError,
  isSaving,
  onRefresh,
  onMarkPosted,
  onSaveLearning,
  onUpdateCampaign,
  onStartNextCampaign,
  onDirtyChange,
}: Readonly<{
  summaryResult?: HonestFitMissionSummaryResult
  summaryLoading: boolean
  summaryError?: Error | null
  state: HonestFitMarketingCampaignState
  saveError?: Error | null
  isSaving: boolean
  onRefresh?: () => void
  onMarkPosted?: MarketingCommandCenterViewProps['onMarkPosted']
  onSaveLearning?: MarketingCommandCenterViewProps['onSaveLearning']
  onUpdateCampaign?: MarketingCommandCenterViewProps['onUpdateCampaign']
  onStartNextCampaign?: MarketingCommandCenterViewProps['onStartNextCampaign']
  onDirtyChange?: MarketingCommandCenterViewProps['onDirtyChange']
}>) {
  const [selectedCampaignId, setSelectedCampaignId] = useState(
    state.selectedCampaignId,
  )
  const campaign =
    state.campaigns.find((item) => item.id === selectedCampaignId) ??
    state.campaigns[0]
  const [postedUrl, setPostedUrl] = useState(campaign.postedUrl ?? '')
  const [editFields, setEditFields] = useState(() => editFieldsFor(campaign))
  const [learningFields, setLearningFields] = useState(() =>
    learningFieldsFor(campaign),
  )
  const [copiedPostBody, setCopiedPostBody] = useState<string | null>(null)
  const lastServerSelectedId = useRef(state.selectedCampaignId)

  useEffect(() => {
    setPostedUrl(campaign.postedUrl ?? '')
    setEditFields(editFieldsFor(campaign))
    setLearningFields(learningFieldsFor(campaign))
    setCopiedPostBody(null)
  }, [campaign.id, campaign.updatedAt, campaign.postedUrl])

  const editDirty = fieldsDiffer(editFields, editFieldsFor(campaign))
  const learningDirty = fieldsDiffer(
    learningFields,
    learningFieldsFor(campaign),
  )
  const postedUrlDirty = postedUrl !== (campaign.postedUrl ?? '')
  const hasUnsavedChanges = editDirty || learningDirty || postedUrlDirty
  const hasPublishConflict = editDirty && postedUrlDirty
  const copied =
    copiedPostBody !== null && copiedPostBody === editFields.postBody
  const summary =
    summaryResult?.status === 'success' ? summaryResult.summary : undefined

  useEffect(() => {
    if (state.selectedCampaignId === lastServerSelectedId.current) return
    if (hasUnsavedChanges) return
    lastServerSelectedId.current = state.selectedCampaignId
    const nextCampaign =
      state.campaigns.find((item) => item.id === state.selectedCampaignId) ??
      state.campaigns[0]
    setSelectedCampaignId(nextCampaign.id)
  }, [state.selectedCampaignId, hasUnsavedChanges])

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onDirtyChange])

  useEffect(
    () => () => onDirtyChange?.(false),
    [onDirtyChange],
  )

  function discardLocalChanges() {
    setPostedUrl(campaign.postedUrl ?? '')
    setEditFields(editFieldsFor(campaign))
    setLearningFields(learningFieldsFor(campaign))
    setCopiedPostBody(null)
  }

  function selectCampaign(id: string) {
    if (hasUnsavedChanges || id === campaign.id) return
    setSelectedCampaignId(id)
  }

  async function copyPost() {
    if (!navigator.clipboard) return
    await navigator.clipboard.writeText(editFields.postBody)
    setCopiedPostBody(editFields.postBody)
  }

  return (
    <div className="campaign-editor space-y-5">
      <CampaignDecision
        campaign={campaign}
        summary={summary}
        isRefreshing={summaryLoading || isSaving}
        refreshDisabled={hasUnsavedChanges}
        onRefresh={onRefresh}
      />

      <EvidencePanel
        summary={summary}
        summaryResult={summaryResult}
        isLoading={summaryLoading}
        error={summaryError}
        campaign={campaign}
      />

      <section
        className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950"
        aria-labelledby="marketing-coverage"
      >
        <div className="flex items-start gap-3">
          <Info className="mt-1 h-5 w-5 shrink-0 text-mission-cobalt" aria-hidden="true" />
          <div>
            <h2 id="marketing-coverage" className="font-semibold">
              Organic and owned campaign control
            </h2>
            <p className="mt-1">
              Paid-media spend, budget, impressions, reach, and cost evidence are not connected. Mission does not fabricate an advertising-platform view.
            </p>
          </div>
        </div>
      </section>

      {saveError ? (
        <section
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950"
          role="alert"
        >
          Campaign changes were not saved. Your local edits remain in this view so you can retry.
        </section>
      ) : null}

      {hasUnsavedChanges ? (
        <section
          className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <div>
            <div className="font-semibold text-amber-950">Unsaved campaign changes</div>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              {hasPublishConflict
                ? 'Campaign copy and a live URL are both unsaved. Clear the URL, save the campaign copy, then re-enter the URL to mark it posted.'
                : 'Save or discard these edits before opening another campaign.'}
            </p>
          </div>
          <button
            type="button"
            onClick={discardLocalChanges}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-400 bg-white px-4 text-sm font-semibold text-amber-950 hover:bg-amber-100"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Discard local changes
          </button>
        </section>
      ) : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <CampaignQueue
          campaigns={state.campaigns}
          selectedCampaignId={campaign.id}
          selectionLocked={hasUnsavedChanges}
          onSelect={selectCampaign}
        />

        <div className="min-w-0 space-y-5">
          <CampaignComposer
            campaign={campaign}
            editFields={editFields}
            setEditFields={setEditFields}
            editDirty={editDirty}
            postedUrl={postedUrl}
            postedUrlDirty={postedUrlDirty}
            setPostedUrl={setPostedUrl}
            copied={copied}
            isSaving={isSaving}
            onCopy={() => void copyPost()}
            onSave={() => onUpdateCampaign?.(campaign.id, editFields)}
            onMarkPosted={() =>
              onMarkPosted?.({ campaignId: campaign.id, postedUrl })
            }
          />

          <CampaignLearning
            campaign={campaign}
            fields={learningFields}
            setFields={setLearningFields}
            dirty={learningDirty}
            isSaving={isSaving}
            onSave={() =>
              onSaveLearning?.({ campaignId: campaign.id, ...learningFields })
            }
          />

          {campaign.status === 'learning_captured' ? (
            <NextCampaign
              campaigns={state.campaigns}
              isSaving={isSaving}
              onStart={onStartNextCampaign}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CampaignDecision({
  campaign,
  summary,
  isRefreshing,
  refreshDisabled,
  onRefresh,
}: Readonly<{
  campaign: HonestFitMarketingCampaign
  summary?: HonestFitMissionSummary
  isRefreshing: boolean
  refreshDisabled: boolean
  onRefresh?: () => void
}>) {
  const decision = nextOperatorMove(campaign, summary)
  return (
    <section className="mission-card overflow-hidden border-l-4 border-l-mission-gold" aria-labelledby="marketing-decision">
      <div className="bg-mission-shell px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-200">
                Marketing decision
              </div>
              <h2 id="marketing-decision" className="mt-2 text-2xl font-semibold tracking-tight">
                {decision.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100/80">
                {decision.detail}
              </p>
            </div>
          </div>
          <span className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white">
            {statusLabel(campaign.status)}
          </span>
        </div>
      </div>
      <div className="grid gap-px border-t border-mission-border bg-mission-border sm:grid-cols-3">
        <DecisionFact label="Selected campaign" value={campaign.title} />
        <DecisionFact label="Channel" value={titleCase(campaign.channel)} />
        <DecisionFact label="Last campaign update" value={formattedTimestamp(campaign.updatedAt)} />
      </div>
      <div className="flex flex-col gap-2 border-t border-mission-border bg-white p-4 sm:flex-row sm:justify-end">
        <a
          href={campaign.targetUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-mission-border px-4 text-sm font-semibold text-mission-cobalt hover:border-mission-cobalt hover:bg-blue-50"
        >
          Open target
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
        <button
          type="button"
          disabled={refreshDisabled}
          onClick={onRefresh}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-mission-border px-4 text-sm font-semibold text-mission-cobalt hover:border-mission-cobalt hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {refreshDisabled ? 'Save or discard edits' : isRefreshing ? 'Refreshing…' : 'Refresh sources'}
        </button>
      </div>
    </section>
  )
}

function DecisionFact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0 bg-white px-5 py-4 sm:px-6">
      <div className="text-xs font-semibold uppercase tracking-wide text-mission-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-mission-ink" title={value}>{value}</div>
    </div>
  )
}

function EvidencePanel({
  summary,
  summaryResult,
  isLoading,
  error,
  campaign,
}: Readonly<{
  summary?: HonestFitMissionSummary
  summaryResult?: HonestFitMissionSummaryResult
  isLoading: boolean
  error?: Error | null
  campaign: HonestFitMarketingCampaign
}>) {
  if (isLoading && !summaryResult) {
    return (
      <WorkspaceSourceState
        title="Loading marketing evidence"
        detail="Campaign controls remain available while rolling-24-hour telemetry loads."
      />
    )
  }
  if (error || summaryResult?.status === 'error') {
    return (
      <WorkspaceSourceState
        title="Marketing evidence unavailable"
        detail="Campaign controls remain available. Mission does not convert a telemetry failure into zero traffic or zero response."
        tone="warning"
      />
    )
  }
  if (summaryResult?.status === 'unavailable' || !summary) {
    return (
      <WorkspaceSourceState
        title="Marketing evidence unavailable"
        detail="The protected HonestFit summary is unavailable. Campaign controls remain available, and no result is inferred."
        tone="warning"
      />
    )
  }

  const ctaEvents = totalCtaEvents(summary)
  const topSource = summary.marketing.trafficSources24h[0]
  const topSourceLabel = topSource
    ? `${topSource.source ?? topSource.referrer ?? 'Unknown'} · ${topSource.visits}`
    : 'No source events observed'
  const narrative = evidenceNarrative(summary, campaign)
  return (
    <section className="mission-card p-5 sm:p-6" aria-labelledby="marketing-evidence">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Signal className="mt-0.5 h-5 w-5 shrink-0 text-mission-cobalt" aria-hidden="true" />
          <div>
            <div className="mission-eyebrow">Rolling 24 hours</div>
            <h2 id="marketing-evidence" className="mt-2 text-lg font-semibold text-mission-ink">Market response evidence</h2>
            <p className="mission-meta mt-1">{narrative}</p>
          </div>
        </div>
        <span className="inline-flex min-h-11 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-950">
          Aggregate events · not people
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-mission-border bg-mission-border xl:grid-cols-4">
        <EvidenceFact label="Estimated real visits" value={summary.traffic.classification.estimatedReal} />
        <EvidenceFact label="CTA events" value={ctaEvents} />
        <EvidenceFact label="Sign-in requests" value={summary.funnel.magicLinksRequested24h} />
        <EvidenceFact label="Top source" value={topSourceLabel} />
      </div>
      <p className="mt-4 text-xs leading-5 text-mission-muted">
        This window is not filtered from the campaign post time. Custom “since posted” attribution is unsupported, and Mission does not calculate conversion ratios from these aggregate counts.
      </p>
    </section>
  )
}

function EvidenceFact({ label, value }: Readonly<{ label: string; value: string | number }>) {
  return (
    <div className="bg-white p-4">
      <div className="text-xs font-medium text-mission-muted">{label}</div>
      <div className="mt-2 text-lg font-semibold tabular-nums text-mission-ink">{value}</div>
      {typeof value === 'number' && value === 0 ? (
        <div className="mt-1 text-xs text-mission-muted">Zero observed events</div>
      ) : null}
    </div>
  )
}

function CampaignQueue({
  campaigns,
  selectedCampaignId,
  selectionLocked,
  onSelect,
}: Readonly<{
  campaigns: HonestFitMarketingCampaign[]
  selectedCampaignId: string
  selectionLocked: boolean
  onSelect: (id: string) => void
}>) {
  const selected = campaigns.find((campaign) => campaign.id === selectedCampaignId)
  const queue = (
    <div className="space-y-4">
      {queueGroups.map((group) => {
        const items = campaigns.filter((campaign) =>
          group.statuses.includes(campaign.status),
        )
        if (items.length === 0) return null
        return (
          <div key={group.label}>
            <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-mission-muted">
              <span>{group.label}</span>
              <span>{items.length}</span>
            </div>
            <div className="mt-2 space-y-2">
              {items.map((item) => {
                const isSelected = item.id === selectedCampaignId
                const locked = selectionLocked && !isSelected
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${item.title}, ${statusLabel(item.status)}`}
                    disabled={locked}
                    onClick={() => onSelect(item.id)}
                    className={`w-full rounded-lg border p-3 text-left disabled:cursor-not-allowed disabled:opacity-45 ${
                      isSelected
                        ? 'border-mission-cobalt bg-blue-50 shadow-[inset_3px_0_0_rgb(var(--mc-cobalt))]'
                        : 'border-mission-border bg-white hover:border-mission-cobalt hover:bg-blue-50'
                    }`}
                  >
                    <span className="block text-sm font-semibold leading-5 text-mission-ink">{item.title}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mission-muted">
                      <span>{titleCase(item.channel)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{statusLabel(item.status)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      <details className="group mission-card h-fit min-w-0 overflow-hidden xl:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-mission-ink">Campaign pipeline · {campaigns.length}</span>
            <span className="mt-0.5 block truncate text-xs text-mission-muted">Selected: {selected?.title ?? 'Unknown campaign'}</span>
          </span>
          <span className="text-lg font-semibold text-mission-cobalt group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true">›</span>
        </summary>
        <div className="border-t border-mission-border p-4">{queue}</div>
      </details>
      <section className="mission-card hidden h-fit min-w-0 p-4 xl:block" aria-labelledby="campaign-queue">
        <div className="flex items-center justify-between gap-3">
          <h2 id="campaign-queue" className="text-lg font-semibold text-mission-ink">Campaign pipeline</h2>
          <span className="text-xs font-semibold text-mission-muted">{campaigns.length} total</span>
        </div>
        <p className="mission-meta mt-1">Choose one campaign to plan, publish, or learn from.</p>
        <div className="mt-4">{queue}</div>
      </section>
    </>
  )
}

function CampaignComposer({
  campaign,
  editFields,
  setEditFields,
  editDirty,
  postedUrl,
  postedUrlDirty,
  setPostedUrl,
  copied,
  isSaving,
  onCopy,
  onSave,
  onMarkPosted,
}: Readonly<{
  campaign: HonestFitMarketingCampaign
  editFields: CampaignEditFields
  setEditFields: React.Dispatch<React.SetStateAction<CampaignEditFields>>
  editDirty: boolean
  postedUrl: string
  postedUrlDirty: boolean
  setPostedUrl: (value: string) => void
  copied: boolean
  isSaving: boolean
  onCopy: () => void
  onSave: () => void
  onMarkPosted: () => void
}>) {
  const canEdit = campaign.status === 'draft' || campaign.status === 'ready'
  const hasPosted = Boolean(campaign.postedAt || campaign.postedUrl)

  function updateField<Key extends keyof CampaignEditFields>(
    key: Key,
    value: CampaignEditFields[Key],
  ) {
    setEditFields((fields) => ({ ...fields, [key]: value }))
  }

  return (
    <section className="mission-card min-w-0 p-5 sm:p-6" aria-labelledby="campaign-message">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mission-eyebrow">Selected campaign</div>
          <h2 id="campaign-message" className="mt-2 text-xl font-semibold text-mission-ink">{campaign.title}</h2>
          <p className="mission-meta mt-1">{campaign.angle} · {campaign.audience}</p>
        </div>
        <span className="inline-flex min-h-11 items-center rounded-full border border-mission-border bg-mission-canvas px-3 text-xs font-semibold text-mission-ink">
          {statusLabel(campaign.status)}
        </span>
      </div>

      {canEdit ? (
        <div className="mt-5 space-y-4">
          <TextField label="Campaign title" value={editFields.title} onChange={(value) => updateField('title', value)} />
          <TextField label="Hook" value={editFields.hook} onChange={(value) => updateField('hook', value)} />
          <TextAreaField label="Post body" value={editFields.postBody} onChange={(value) => updateField('postBody', value)} rows={9} />

          <details className="group rounded-lg border border-mission-border">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-mission-cobalt">
              Message strategy and delivery details
              <span className="text-lg group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true">›</span>
            </summary>
            <div className="grid gap-4 border-t border-mission-border p-4 md:grid-cols-2">
              <TextField label="Audience" value={editFields.audience} onChange={(value) => updateField('audience', value)} />
              <TextField label="Target URL" value={editFields.targetUrl} onChange={(value) => updateField('targetUrl', value)} type="url" />
              <TextField label="Suggested screenshot" value={editFields.suggestedScreenshot} onChange={(value) => updateField('suggestedScreenshot', value)} />
              <TextField label="Feedback ask" value={editFields.feedbackAsk} onChange={(value) => updateField('feedbackAsk', value)} />
              <div className="md:col-span-2">
                <TextAreaField label="Hypothesis" value={editFields.hypothesis} onChange={(value) => updateField('hypothesis', value)} rows={4} />
              </div>
            </div>
          </details>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-mission-border bg-white px-4 text-sm font-semibold text-mission-cobalt hover:border-mission-cobalt hover:bg-blue-50"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Clipboard className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy post body'}
            </button>
            <span className="sr-only" aria-live="polite">{copied ? 'Post body copied to clipboard' : ''}</span>
            <button
              type="button"
              disabled={isSaving || !editDirty || postedUrlDirty}
              onClick={onSave}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-mission-cobalt px-4 text-sm font-semibold text-white hover:bg-mission-navy disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {isSaving ? 'Saving…' : 'Save campaign'}
            </button>
          </div>

          <div className="rounded-lg border border-mission-border bg-mission-canvas p-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-mission-cobalt" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-mission-ink">Confirm the live post</h3>
                <p className="mission-meta mt-1">Publish on {titleCase(campaign.channel)}, then save the public post URL to begin the learning window.</p>
                <div className="mt-3 flex flex-col gap-2 lg:flex-row">
                  <label className="min-w-0 flex-1 text-sm font-medium text-mission-ink">
                    <span className="sr-only">Posted URL</span>
                    <input
                      type="url"
                      value={postedUrl}
                      onChange={(event) => setPostedUrl(event.target.value)}
                      placeholder="https://www.linkedin.com/posts/..."
                      className="min-h-11 w-full rounded-lg border border-mission-border bg-white px-3 text-base text-mission-ink placeholder:text-mission-muted"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={isSaving || !postedUrl.trim() || editDirty}
                    onClick={onMarkPosted}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-mission-gold px-4 text-sm font-semibold text-mission-shell hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Mark as posted
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {editDirty ? (
                  <p className="mt-2 text-xs font-medium text-amber-800">
                    Save the campaign copy before marking this campaign as posted.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {hasPosted ? (
            <div className="rounded-lg border border-mission-border bg-mission-canvas p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyFact label="Posted" value={campaign.postedAt ? formattedTimestamp(campaign.postedAt) : 'Time unavailable'} />
                <ReadOnlyFact label="Check after" value={campaign.checkAfter ? formattedTimestamp(campaign.checkAfter) : 'Time unavailable'} />
              </div>
              {campaign.postedUrl ? (
                <a href={campaign.postedUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 max-w-full items-center gap-2 break-all text-sm font-semibold text-mission-cobalt hover:underline">
                  Open live post
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          ) : null}
          <details className="group rounded-lg border border-mission-border">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-mission-cobalt">
              Review published message and brief
              <span className="text-lg group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true">›</span>
            </summary>
            <div className="space-y-4 border-t border-mission-border p-4">
              <ReadOnlyFact label="Hook" value={campaign.hook} />
              <ReadOnlyFact label="Hypothesis" value={campaign.hypothesis} />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Post body</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-mission-ink">{campaign.postBody}</p>
              </div>
            </div>
          </details>
        </div>
      )}
    </section>
  )
}

function CampaignLearning({
  campaign,
  fields,
  setFields,
  dirty,
  isSaving,
  onSave,
}: Readonly<{
  campaign: HonestFitMarketingCampaign
  fields: LearningFields
  setFields: React.Dispatch<React.SetStateAction<LearningFields>>
  dirty: boolean
  isSaving: boolean
  onSave: () => void
}>) {
  const canRecord = campaign.status === 'posted' || campaign.status === 'waiting_for_data'
  if (!canRecord && campaign.status !== 'learning_captured') return null

  if (campaign.status === 'learning_captured') {
    return (
      <section className="mission-card p-5 sm:p-6" aria-labelledby="campaign-learning">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-mission-gold" aria-hidden="true" />
          <div>
            <div className="mission-eyebrow">Learning captured</div>
            <h2 id="campaign-learning" className="mt-2 text-lg font-semibold text-mission-ink">What this campaign taught us</h2>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <ReadOnlyFact label="What happened" value={campaign.learningWhatHappened || 'No result note was recorded'} />
          <ReadOnlyFact label="What was confusing" value={campaign.learningWhatWasConfusing || 'No confusion note was recorded'} />
          <ReadOnlyFact label="Next message angle" value={campaign.nextMessageAngle || 'No next angle was recorded'} />
        </div>
      </section>
    )
  }

  return (
    <section className="mission-card p-5 sm:p-6" aria-labelledby="campaign-learning">
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-mission-gold" aria-hidden="true" />
        <div>
          <div className="mission-eyebrow">Close the loop</div>
          <h2 id="campaign-learning" className="mt-2 text-lg font-semibold text-mission-ink">Capture qualitative learning</h2>
          <p className="mission-meta mt-1">Record observed response and founder interpretation. Rolling telemetry remains separately scoped.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <TextAreaField label="What happened" value={fields.learningWhatHappened} onChange={(value) => setFields((current) => ({ ...current, learningWhatHappened: value }))} rows={5} />
        <TextAreaField label="What was confusing" value={fields.learningWhatWasConfusing} onChange={(value) => setFields((current) => ({ ...current, learningWhatWasConfusing: value }))} rows={5} />
        <TextAreaField label="Next message angle" value={fields.nextMessageAngle} onChange={(value) => setFields((current) => ({ ...current, nextMessageAngle: value }))} rows={5} />
      </div>
      <button
        type="button"
        disabled={isSaving || !dirty}
        onClick={onSave}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-mission-cobalt px-4 text-sm font-semibold text-white hover:bg-mission-navy disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        Save campaign learning
      </button>
    </section>
  )
}

function NextCampaign({
  campaigns,
  isSaving,
  onStart,
}: Readonly<{
  campaigns: HonestFitMarketingCampaign[]
  isSaving: boolean
  onStart?: (draftId: string) => void
}>) {
  const prepared = campaigns.filter((campaign) => campaign.status === 'ready')
  return (
    <section className="mission-card p-5 sm:p-6" aria-labelledby="next-campaign">
      <div className="mission-eyebrow">Next experiment</div>
      <h2 id="next-campaign" className="mt-2 text-lg font-semibold text-mission-ink">Choose the next prepared angle</h2>
      <p className="mission-meta mt-1">Starting a prepared angle creates a new editable campaign and preserves this learning record.</p>
      {prepared.length === 0 ? (
        <p className="mt-4 rounded-lg border border-mission-border bg-mission-canvas p-4 text-sm text-mission-muted">No prepared campaign is available.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {prepared.map((campaign) => (
            <button
              key={campaign.id}
              type="button"
              disabled={isSaving}
              onClick={() => onStart?.(campaign.id)}
              className="flex min-h-20 items-center justify-between gap-4 rounded-lg border border-mission-border bg-white p-4 text-left hover:border-mission-cobalt hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>
                <span className="block text-sm font-semibold text-mission-ink">{campaign.title}</span>
                <span className="mt-1 block text-xs text-mission-muted">{campaign.angle}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-mission-cobalt" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: Readonly<{
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'url'
}>) {
  return (
    <label className="block text-sm font-medium text-mission-ink">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 min-h-11 w-full rounded-lg border border-mission-border bg-white px-3 text-base text-mission-ink"
      />
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  rows,
}: Readonly<{
  label: string
  value: string
  onChange: (value: string) => void
  rows: number
}>) {
  return (
    <label className="block text-sm font-medium text-mission-ink">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-1.5 w-full resize-y rounded-lg border border-mission-border bg-white p-3 text-base leading-6 text-mission-ink"
      />
    </label>
  )
}

function ReadOnlyFact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-mission-muted">{label}</div>
      <div className="mt-1 break-words text-sm leading-6 text-mission-ink">{value}</div>
    </div>
  )
}

function editFieldsFor(campaign: HonestFitMarketingCampaign): CampaignEditFields {
  return {
    title: campaign.title,
    hook: campaign.hook,
    postBody: campaign.postBody,
    audience: campaign.audience,
    hypothesis: campaign.hypothesis,
    targetUrl: campaign.targetUrl,
    suggestedScreenshot: campaign.suggestedScreenshot,
    feedbackAsk: campaign.feedbackAsk,
  }
}

function learningFieldsFor(campaign: HonestFitMarketingCampaign): LearningFields {
  return {
    learningWhatHappened: campaign.learningWhatHappened,
    learningWhatWasConfusing: campaign.learningWhatWasConfusing,
    nextMessageAngle: campaign.nextMessageAngle,
  }
}

function fieldsDiffer<T extends Record<string, string>>(left: T, right: T) {
  return Object.keys(left).some((key) => left[key] !== right[key])
}

function statusLabel(status: HonestFitMarketingCampaignStatus) {
  const labels: Record<HonestFitMarketingCampaignStatus, string> = {
    draft: 'Draft in progress',
    ready: 'Prepared',
    posted: 'Posted',
    waiting_for_data: 'Measuring response',
    learning_captured: 'Learning captured',
    archived: 'Archived',
  }
  return labels[status]
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function totalCtaEvents(summary: HonestFitMissionSummary) {
  return Object.values(summary.marketing.cta24h).reduce(
    (total, value) => total + value,
    0,
  )
}

function evidenceNarrative(
  summary: HonestFitMissionSummary,
  campaign: HonestFitMarketingCampaign,
) {
  const visits = summary.traffic.classification.estimatedReal
  const clicks = totalCtaEvents(summary)
  const signIns = summary.funnel.magicLinksRequested24h
  if (visits === 0) {
    return 'No estimated real visits were observed. Distribution is the next question before changing the product or message.'
  }
  if (clicks === 0) {
    return 'Interest is visible, but no CTA events were observed. The message or call to action may need clarification.'
  }
  if (signIns === 0) {
    return 'CTA activity is visible, but no sign-in requests were observed. Inspect the landing and signup handoff.'
  }
  if (campaign.learningWhatWasConfusing.trim()) {
    return 'Response is visible and qualitative confusion was recorded. Tighten the problem statement before repeating the angle.'
  }
  return 'Traffic and downstream event activity are visible. Capture qualitative learning before choosing the next angle.'
}

function nextOperatorMove(
  campaign: HonestFitMarketingCampaign,
  summary?: HonestFitMissionSummary,
) {
  if (campaign.status === 'draft' || campaign.status === 'ready') {
    return {
      title: `Finish and publish “${campaign.title}”`,
      detail: 'Review the hook, copy the final message, publish it on the declared channel, and save the live URL.',
    }
  }
  if (campaign.status === 'posted' || campaign.status === 'waiting_for_data') {
    return {
      title: 'Measure the live post, then capture what you learned',
      detail: summary
        ? evidenceNarrative(summary, campaign)
        : 'Campaign telemetry is unavailable. Keep the live post state and record qualitative response without inferring a result.',
    }
  }
  if (campaign.status === 'learning_captured') {
    return {
      title: 'Turn the learning into the next message test',
      detail: campaign.nextMessageAngle
        ? `Use the recorded direction: ${campaign.nextMessageAngle}`
        : 'Choose one prepared angle and create a new editable campaign.',
    }
  }
  return {
    title: 'Review this archived campaign for context',
    detail: 'Archived campaigns are read-only history. Choose an in-progress or prepared campaign to take action.',
  }
}
