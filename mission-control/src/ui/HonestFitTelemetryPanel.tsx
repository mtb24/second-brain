import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import {
  buildHonestFitOperatorBriefing,
  type HonestFitOperatorBriefingStatus,
} from '@/server/honestFitOperatorBriefing'
import {
  defaultHonestFitMarketingExperiment,
  preparedHonestFitMarketingCampaignDrafts,
  type HonestFitMarketingCampaign,
  type HonestFitMarketingCampaignState,
  type HonestFitMarketingExperiment,
} from '@/lib/honestFitMarketingExperiment'
import type {
  HonestFitMissionSummary,
  HonestFitMissionSummaryResult,
} from '@/server/honestFitMissionSummary'

async function fetchHonestFitTelemetry(
  since?: string | null,
): Promise<HonestFitMissionSummaryResult> {
  const params = new URLSearchParams()
  if (since) params.set('since', since)
  const suffix = params.size ? `?${params.toString()}` : ''
  const res = await fetch(`/api/honestfit/mission-summary${suffix}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error('Unable to load HonestFit telemetry')
  }
  return res.json()
}

async function fetchHonestFitMarketingExperiment(): Promise<HonestFitMarketingCampaignState> {
  const res = await fetch('/api/honestfit/marketing-experiment', {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error('Unable to load HonestFit marketing experiment')
  }
  return res.json()
}

async function patchHonestFitMarketingExperiment(
  body: Record<string, unknown>,
): Promise<HonestFitMarketingCampaignState> {
  const res = await fetch('/api/honestfit/marketing-experiment', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error('Unable to save HonestFit marketing experiment')
  }
  return res.json()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return 'None'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function statusTone(status: HonestFitMissionSummary['health']['status']) {
  if (status === 'ok')
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'blocked')
    return 'border-red-500/40 bg-red-500/10 text-red-200'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-200'
}

function briefingTone(status: HonestFitOperatorBriefingStatus) {
  if (status === 'ok')
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'needs_attention')
    return 'border-red-500/40 bg-red-500/10 text-red-200'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-200'
}

function briefingLabel(status: HonestFitOperatorBriefingStatus) {
  if (status === 'needs_attention') return 'Needs attention'
  if (status === 'watch') return 'Watch'
  return 'OK'
}

type FunnelStep = {
  label: string
  phrase: string
  value: number
}

function buildLaunchFunnelSteps(
  summary: HonestFitMissionSummary,
): FunnelStep[] {
  const traffic = summary.traffic.classification
  return [
    {
      label: 'Estimated real visits',
      phrase: 'estimated real visits',
      value: traffic.estimatedReal,
    },
    {
      label: 'Sign-in started',
      phrase: 'sign-in started',
      value: summary.funnel.magicLinksRequested24h,
    },
    {
      label: 'Signed in',
      phrase: 'signed in',
      value: summary.funnel.magicLinksConsumed24h,
    },
    {
      label: 'Profile viewed',
      phrase: 'profile viewed',
      value: summary.funnel.profileViews24h,
    },
    {
      label: 'Capture started',
      phrase: 'capture started',
      value: summary.funnel.captureStarted24h,
    },
    {
      label: 'Capture saved',
      phrase: 'capture saved',
      value: summary.funnel.captureSaved24h,
    },
    {
      label: 'Fit viewed',
      phrase: 'fit viewed',
      value: summary.funnel.fitViewed24h,
    },
    {
      label: 'Fit/report action',
      phrase: 'fit/report action',
      value:
        summary.funnel.fitReportsRequested24h +
        summary.funnel.resumeGenerated24h,
    },
  ]
}

function formatConversion(step: FunnelStep, previous?: FunnelStep) {
  if (!previous || previous.value <= 0) return '—'
  const conversion = Math.round((step.value / previous.value) * 100)
  return `${conversion}% from ${previous.label.toLowerCase()}`
}

function launchFunnelInsight(steps: FunnelStep[]) {
  const estimatedRealVisits = steps[0]?.value ?? 0
  const signInStarted = steps[1]?.value ?? 0
  const signedIn = steps[2]?.value ?? 0
  const profileViewed = steps[3]?.value ?? 0
  const captureStarted = steps[4]?.value ?? 0
  const captureSaved = steps[5]?.value ?? 0
  const fitViewed = steps[6]?.value ?? 0
  const fitReportAction = steps[7]?.value ?? 0

  if (estimatedRealVisits < 10) {
    return 'Current launch signal is too low to diagnose conversion'
  }
  if (signInStarted === 0) return 'No sign-in attempts yet'
  if (profileViewed > 0 && captureStarted === 0) {
    return 'Visitors are reaching profile, but capture has not started yet'
  }
  if (captureSaved > 0 && fitViewed === 0) {
    return 'Capture is working; next watch fit/report usage'
  }
  if (fitViewed > 0 && fitReportAction === 0) {
    return 'Capture is working; next watch fit/report usage'
  }

  let biggestDrop: {
    from: FunnelStep
    to: FunnelStep
    dropRate: number
  } | null = null

  for (let index = 1; index < steps.length; index += 1) {
    const from = steps[index - 1]
    const to = steps[index]
    if (!from || !to || from.value <= 0) continue

    const dropRate = Math.max(0, (from.value - to.value) / from.value)
    if (!biggestDrop || dropRate > biggestDrop.dropRate) {
      biggestDrop = { from, to, dropRate }
    }
  }

  if (biggestDrop && biggestDrop.dropRate > 0) {
    return `Biggest drop-off: ${biggestDrop.from.label} -> ${biggestDrop.to.label}`
  }

  if (signedIn > 0)
    return 'Sign-in is converting; watch profile and capture depth'
  return 'Launch funnel is waiting for visitor activity'
}

function LaunchFunnelCard({
  summary,
}: Readonly<{ summary: HonestFitMissionSummary }>) {
  const steps = buildLaunchFunnelSteps(summary)
  const maxValue = Math.max(...steps.map((step) => step.value), 1)
  const insight = launchFunnelInsight(steps)

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">
            HonestFit Launch Funnel
          </h4>
          <div className="mt-1 text-xs text-slate-500">Last 24 hours</div>
        </div>
        <div className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-100">
          {insight}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {steps.map((step, index) => {
          const previous = steps[index - 1]
          const width =
            step.value === 0
              ? '0%'
              : `${Math.max(3, Math.round((step.value / maxValue) * 100))}%`
          const conversion = formatConversion(step, previous)

          return (
            <div
              key={step.label}
              className="grid gap-2 rounded border border-slate-800/80 bg-slate-900/50 p-2 md:grid-cols-[150px_minmax(0,1fr)_210px] md:items-center"
            >
              <div className="text-xs font-medium text-slate-200">
                {step.label}
              </div>
              <div className="h-3 overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full rounded bg-cyan-400"
                  style={{ width }}
                  aria-hidden="true"
                />
              </div>
              <div className="text-xs text-slate-400 md:text-right">
                <span className="font-semibold text-slate-100">
                  {formatNumber(step.value)}
                </span>{' '}
                {step.phrase} <span className="text-slate-600">-</span>{' '}
                {conversion}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function topList(
  items: { path?: string; source?: string; views: number }[],
  emptyLabel: string,
) {
  const visible = items.slice(0, 3)
  if (visible.length === 0) {
    return <li className="text-slate-500">{emptyLabel}</li>
  }

  return visible.map((item) => (
    <li
      key={`${item.path ?? item.source}-${item.views}`}
      className="flex min-w-0 items-center justify-between gap-3"
    >
      <span className="truncate text-slate-300">
        {item.path ?? item.source}
      </span>
      <span className="shrink-0 font-mono text-slate-500">
        {formatNumber(item.views)}
      </span>
    </li>
  ))
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-100">
        {formatNumber(value)}
      </div>
    </div>
  )
}

function TrafficClassificationCard({
  summary,
}: Readonly<{ summary: HonestFitMissionSummary }>) {
  const classification = summary.traffic.classification
  return (
    <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        Real-user estimate
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">
        {formatNumber(classification.estimatedReal)}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        Raw page views: {formatNumber(classification.raw)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
        <span>Testing/smoke/admin</span>
        <span className="text-right font-mono">
          {formatNumber(classification.testingSmokeAdmin)}
        </span>
        <span>Ambiguous</span>
        <span className="text-right font-mono">
          {formatNumber(classification.ambiguous)}
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Classification excludes internal_smoke, local_test, production_probe,
        system, deploy smoke, public-profile smoke, and Mission proxy checks
        from real-user counts. Direct homepage, login, and public-profile
        traffic stays ambiguous until attribution proves it is qualified user
        traffic.
      </p>
      <p className="mt-2 text-xs leading-5 text-amber-200">
        Current launch signal is too low to diagnose conversion. Need more
        qualified traffic before changing product based on funnel numbers.
      </p>
    </div>
  )
}

function metricName(
  item: {
    source?: string
    referrer?: string
    campaign?: string
  },
  fallback = 'Unknown',
) {
  return item.source ?? item.referrer ?? item.campaign ?? fallback
}

function marketingTrafficTotal(summary: HonestFitMissionSummary) {
  return summary.traffic.classification.estimatedReal
}

function ctaMetrics(summary: HonestFitMissionSummary) {
  const cta = summary.marketing?.cta24h
  return [
    { label: 'Get Started clicks', value: cta?.getStartedClicks ?? 0 },
    { label: 'Sign In clicks', value: cta?.signInClicks ?? 0 },
    { label: 'View Plans clicks', value: cta?.viewPlansClicks ?? 0 },
    {
      label: 'Partner API email clicks',
      value: cta?.partnerApiEmailClicks ?? 0,
    },
  ]
}

function topMarketingSource(summary: HonestFitMissionSummary) {
  return [...(summary.marketing?.trafficSources24h ?? [])].sort(
    (a, b) => b.visits - a.visits,
  )[0]
}

function topCta(summary: HonestFitMissionSummary) {
  return [...ctaMetrics(summary)].sort((a, b) => b.value - a.value)[0]
}

function totalCtaClicks(summary: HonestFitMissionSummary) {
  return ctaMetrics(summary).reduce((total, item) => total + item.value, 0)
}

function hasMarketingFields(summary: HonestFitMissionSummary) {
  return Boolean(summary.marketing)
}

const alternateHooks = [
  'Resumes make claims. They rarely show what supports them.',
  "A resume is a list of claims. I'm building a way to show what supports them.",
  "I don't think AI resume tools are enough. The harder problem is trust.",
]

const screenshotGuidance = [
  'Screenshot the first fold of /c/ken-downey',
  'Include the Trust claims/evidence section',
  'Avoid screenshots of internal dashboards',
]

const feedbackQuestions = [
  'Without me explaining it, what do you think this page is for?',
  'Does the Trust & Evidence section make sense?',
  'Would this tell you more than a resume?',
]

const checkTomorrowItems = [
  'Public profile visits',
  'Homepage visits',
  'CTA clicks',
  'Sign-in attempts',
  'Comments/replies',
  'What people misunderstood',
]

function defaultExperimentForView(): HonestFitMarketingExperiment {
  const now = new Date(0).toISOString()
  return {
    ...defaultHonestFitMarketingExperiment,
    status: 'draft',
    postDraft: defaultHonestFitMarketingExperiment.postBody,
    postedUrl: null,
    postUrl: null,
    postedAt: null,
    checkAfter: null,
    checkAfterHours: 24,
    learningWhatHappened: '',
    learningWhatWasConfusing: '',
    nextMessageAngle: '',
    createdAt: now,
    updatedAt: now,
  }
}

function pageViewsFor(summary: HonestFitMissionSummary, matcher: RegExp) {
  return summary.traffic.topPages24h
    .filter((item) => item.path && matcher.test(item.path))
    .reduce((total, item) => total + item.views, 0)
}

function publicProfileVisits(summary: HonestFitMissionSummary) {
  return pageViewsFor(summary, /^\/c\/ken-downey\/?$/)
}

function homepageVisits(summary: HonestFitMissionSummary) {
  return pageViewsFor(summary, /^\/$/)
}

function experimentTraffic(summary: HonestFitMissionSummary) {
  return marketingTrafficTotal(summary)
}

function hasUsefulMarketingSignal(summary: HonestFitMissionSummary) {
  return (
    experimentTraffic(summary) > 0 ||
    homepageVisits(summary) > 0 ||
    totalCtaClicks(summary) > 0 ||
    summary.funnel.magicLinksRequested24h > 0 ||
    summary.errors.total24h > 0
  )
}

function experimentMetrics(summary: HonestFitMissionSummary) {
  const ctaClicks = totalCtaClicks(summary)
  return [
    {
      label: 'Public profile visits',
      value: publicProfileVisits(summary),
      fallback: 'No signal yet',
    },
    {
      label: 'Homepage visits',
      value: homepageVisits(summary),
      fallback: 'No signal yet',
    },
    {
      label: 'CTA clicks',
      value: ctaClicks,
      fallback: 'No CTA signal yet',
    },
    {
      label: 'Sign-in attempts',
      value: summary.funnel.magicLinksRequested24h,
      fallback: 'No sign-in attempts yet',
    },
    {
      label: '4xx/5xx errors',
      value: summary.errors.total24h,
      fallback: 'No errors reported',
    },
  ]
}

function isCheckTimePassed(checkAfter: string | null) {
  if (!checkAfter) return false
  const checkAt = new Date(checkAfter)
  if (Number.isNaN(checkAt.getTime())) return false
  return checkAt.getTime() <= Date.now()
}

function workflowStatusForExperiment(
  experiment: HonestFitMarketingExperiment,
  checkAfter: string | null,
) {
  if (experiment.status === 'learning_captured') {
    return {
      headline: 'Learning captured',
      nextAction: 'Choose or create the next experiment.',
    }
  }

  if (experiment.status === 'waiting_for_data') {
    if (isCheckTimePassed(checkAfter)) {
      return {
        headline: 'Time to review results',
        nextAction:
          'Record what happened and choose the next message angle.',
      }
    }

    return {
      headline: 'Post is live — waiting for signal',
      nextAction:
        'Wait until the check time, then record what happened.',
    }
  }

  return {
    headline: 'Publish this post today',
    nextAction: 'Post the draft and save the LinkedIn URL.',
  }
}

function nextExperimentOptions(
  summary: HonestFitMissionSummary,
  experiment: HonestFitMarketingExperiment,
) {
  const options = [
    {
      label: 'No traffic',
      recommendation: 'Try a sharper hook or broader distribution.',
      active: experimentTraffic(summary) === 0,
    },
    {
      label: 'Profile visits but no clicks',
      recommendation: 'Clarify the page CTA or post CTA.',
      active: experimentTraffic(summary) > 0 && totalCtaClicks(summary) === 0,
    },
    {
      label: 'CTA clicks but no sign-ins',
      recommendation: 'Inspect signup friction.',
      active:
        totalCtaClicks(summary) > 0 &&
        summary.funnel.magicLinksRequested24h === 0,
    },
    {
      label: 'Confused replies',
      recommendation: 'Rewrite around the problem, not the feature.',
      active: experiment.learningWhatWasConfusing.trim().length > 0,
    },
  ]

  return options.map((option) => ({
    ...option,
    active:
      option.active ||
      (!options.some((candidate) => candidate.active) &&
        option.label === 'No traffic'),
  }))
}

function CompactList({
  items,
  emptyLabel,
}: Readonly<{
  items: { label: string; value: number }[]
  emptyLabel: string
}>) {
  const visible = items.filter((item) => item.value > 0).slice(0, 4)
  if (visible.length === 0) {
    return <div className="text-xs text-slate-500">{emptyLabel}</div>
  }

  return (
    <ul className="space-y-1 text-xs">
      {visible.map((item) => (
        <li
          key={item.label}
          className="flex min-w-0 items-center justify-between gap-3"
        >
          <span className="truncate text-slate-300">{item.label}</span>
          <span className="shrink-0 font-mono text-slate-500">
            {formatNumber(item.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function MarketingMetricList({
  items,
  emptyLabel,
}: Readonly<{
  items: {
    source?: string
    referrer?: string
    campaign?: string
    visits: number
  }[]
  emptyLabel: string
}>) {
  return (
    <CompactList
      emptyLabel={emptyLabel}
      items={items.map((item) => ({
        label: metricName(item),
        value: item.visits,
      }))}
    />
  )
}

function SignalMetric({
  label,
  value,
  fallback,
}: Readonly<{ label: string; value: number; fallback: string }>) {
  return (
    <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-100">
        {value > 0 ? formatNumber(value) : fallback}
      </div>
    </div>
  )
}

function checkAfterTimestamp(experiment: HonestFitMarketingExperiment) {
  if (!experiment.postedAt) return null
  const posted = new Date(experiment.postedAt)
  if (Number.isNaN(posted.getTime())) return null
  return new Date(
    posted.getTime() + experiment.checkAfterHours * 60 * 60 * 1000,
  ).toISOString()
}

function experimentStatusLabel(status: HonestFitMarketingExperiment['status']) {
  if (status === 'waiting_for_data') return 'Waiting for data'
  if (status === 'learning_captured') return 'Learning captured'
  return 'Draft'
}

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

function campaignStateForView(
  campaign?: HonestFitMarketingCampaign,
): HonestFitMarketingCampaignState {
  const now = new Date(0).toISOString()
  const seededCampaigns = [
    {
      ...defaultHonestFitMarketingExperiment,
      postDraft: defaultHonestFitMarketingExperiment.postBody,
      postedUrl: null,
      postUrl: null,
      postedAt: null,
      checkAfter: null,
      checkAfterHours: 24,
      learningWhatHappened: '',
      learningWhatWasConfusing: '',
      nextMessageAngle: '',
      createdAt: now,
      updatedAt: now,
    },
    ...preparedHonestFitMarketingCampaignDrafts.map((draft) => ({
      ...draft,
      postDraft: draft.postBody,
      postedUrl: null,
      postUrl: null,
      postedAt: null,
      checkAfter: null,
      checkAfterHours: 24,
      learningWhatHappened: '',
      learningWhatWasConfusing: '',
      nextMessageAngle: '',
      createdAt: now,
      updatedAt: now,
    })),
  ]
  const campaigns = campaign
    ? [campaign, ...seededCampaigns.filter((item) => item.id !== campaign.id)]
    : seededCampaigns
  return {
    campaigns,
    selectedCampaignId:
      campaign?.id ??
      campaigns.find((item) => item.status === 'draft' || item.status === 'ready')
        ?.id ??
      campaigns[0].id,
  }
}

function statusBucket(status: HonestFitMarketingCampaign['status']) {
  if (status === 'draft') return 'Active campaign'
  if (status === 'ready') return 'Draft campaigns'
  if (status === 'posted' || status === 'waiting_for_data') {
    return 'Posted/waiting campaigns'
  }
  if (status === 'learning_captured') return 'Learning captured'
  return 'Archived'
}

function selectedCampaignFrom(
  campaigns: HonestFitMarketingCampaign[],
  selectedCampaignId: string,
) {
  return (
    campaigns.find((campaign) => campaign.id === selectedCampaignId) ??
    campaigns.find((campaign) => campaign.status === 'draft') ??
    campaigns[0]
  )
}

function campaignStatusLabel(status: HonestFitMarketingCampaign['status']) {
  if (status === 'waiting_for_data') return 'Waiting for data'
  if (status === 'learning_captured') return 'Learning captured'
  return status.replaceAll('_', ' ')
}

function recommendationForResults(
  summary: HonestFitMissionSummary,
  campaign: HonestFitMarketingCampaign,
) {
  const visits = experimentTraffic(summary)
  const ctaClicks = totalCtaClicks(summary)
  const signIns = summary.funnel.magicLinksRequested24h
  const confused = campaign.learningWhatWasConfusing.trim().length > 0
  const positiveReply =
    /positive|interested|useful|trial|try|clear/i.test(
      campaign.learningWhatHappened,
    ) && signIns === 0

  if (visits === 0) return 'No traffic: try a stronger hook or broader distribution.'
  if (visits > 0 && ctaClicks === 0) {
    return 'Profile visits but no CTA: clarify profile value and the call to action.'
  }
  if (ctaClicks > 0 && signIns === 0) {
    return 'CTA clicks but no sign-ins: inspect signup friction.'
  }
  if (confused) return 'Confused replies: rewrite the problem statement.'
  if (positiveReply) {
    return 'Positive replies but no signups: ask for a direct product trial.'
  }
  return 'Signal is mixed: keep the angle, tighten the ask, and run one more post.'
}

function checkAfterTimestampForCampaign(campaign: HonestFitMarketingCampaign) {
  if (campaign.checkAfter) return campaign.checkAfter
  if (!campaign.postedAt) return null
  const posted = new Date(campaign.postedAt)
  if (Number.isNaN(posted.getTime())) return null
  return new Date(posted.getTime() + 24 * 60 * 60 * 1000).toISOString()
}

function HonestFitMarketingWorkbench({
  summary,
  state,
  selectedCampaignId,
  onSelectCampaign,
  onMarkPosted,
  onSaveLearning,
  onUpdateCampaign,
  onStartNextCampaign,
  isSaving = false,
}: Readonly<{
  summary: HonestFitMissionSummary
  state: HonestFitMarketingCampaignState
  selectedCampaignId: string
  onSelectCampaign?: (campaignId: string) => void
  onMarkPosted?: (input: { campaignId: string; postedUrl: string }) => void
  onSaveLearning?: (
    input: Pick<
      HonestFitMarketingCampaign,
      | 'learningWhatHappened'
      | 'learningWhatWasConfusing'
      | 'nextMessageAngle'
    > & { campaignId: string },
  ) => void
  onUpdateCampaign?: (
    campaignId: string,
    campaign: Partial<CampaignEditFields>,
  ) => void
  onStartNextCampaign?: (draftId: string) => void
  onResetExperiment?: () => void
  isSaving?: boolean
}>) {
  const campaigns = state.campaigns
  const campaign = selectedCampaignFrom(campaigns, selectedCampaignId)
  const topSource = topMarketingSource(summary)
  const marketingReady = hasMarketingFields(summary)
  const hasPosted = Boolean(campaign.postedAt || campaign.postedUrl)
  const canPublish = campaign.status === 'draft' || campaign.status === 'ready'
  const metrics = [
    {
      label: 'Real-user visits',
      value: summary.traffic.classification.estimatedReal,
      fallback: 'No real-user signal yet',
    },
    {
      label: 'Raw visits',
      value: summary.traffic.pageViews24h,
      fallback: 'No raw traffic yet',
    },
    {
      label: 'Testing/smoke/admin',
      value: summary.traffic.classification.testingSmokeAdmin,
      fallback: 'No test traffic',
    },
    {
      label: 'Ambiguous',
      value: summary.traffic.classification.ambiguous,
      fallback: 'No ambiguous traffic',
    },
    {
      label: 'CTA clicks',
      value: totalCtaClicks(summary),
      fallback: 'No CTA signal yet',
    },
    {
      label: 'Sign-in attempts',
      value: summary.funnel.magicLinksRequested24h,
      fallback: 'No sign-in attempts yet',
    },
    {
      label: 'Errors',
      value: summary.errors.total24h,
      fallback: 'No errors reported',
    },
  ]
  const [postedUrl, setPostedUrl] = useState(campaign.postedUrl ?? '')
  const [editFields, setEditFields] = useState<CampaignEditFields>({
    title: campaign.title,
    hook: campaign.hook,
    postBody: campaign.postBody,
    audience: campaign.audience,
    hypothesis: campaign.hypothesis,
    targetUrl: campaign.targetUrl,
    suggestedScreenshot: campaign.suggestedScreenshot,
    feedbackAsk: campaign.feedbackAsk,
  })
  const [learningFields, setLearningFields] = useState({
    learningWhatHappened: campaign.learningWhatHappened,
    learningWhatWasConfusing: campaign.learningWhatWasConfusing,
    nextMessageAngle: campaign.nextMessageAngle,
  })
  const checkAfter = checkAfterTimestampForCampaign(campaign)
  const metricsWindowLabel = hasPosted
    ? `Since active campaign posted ${formatTimestamp(campaign.postedAt)}`
    : 'Last 24 hours until active campaign is posted'
  const recommendation = recommendationForResults(summary, campaign)

  useEffect(() => {
    setPostedUrl(campaign.postedUrl ?? '')
    setEditFields({
      title: campaign.title,
      hook: campaign.hook,
      postBody: campaign.postBody,
      audience: campaign.audience,
      hypothesis: campaign.hypothesis,
      targetUrl: campaign.targetUrl,
      suggestedScreenshot: campaign.suggestedScreenshot,
      feedbackAsk: campaign.feedbackAsk,
    })
    setLearningFields({
      learningWhatHappened: campaign.learningWhatHappened,
      learningWhatWasConfusing: campaign.learningWhatWasConfusing,
      nextMessageAngle: campaign.nextMessageAngle,
    })
  }, [campaign])

  async function copyPost() {
    await navigator.clipboard?.writeText(editFields.postBody)
  }

  function updateField<Key extends keyof CampaignEditFields>(
    key: Key,
    value: CampaignEditFields[Key],
  ) {
    setEditFields((fields) => ({ ...fields, [key]: value }))
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">
            HonestFit Marketing Workbench
          </h4>
          <div className="mt-1 text-xs text-slate-500">
            Actionable campaign queue, publishing state, learning, and next post
          </div>
        </div>
        <a
          href={campaign.targetUrl}
          className="rounded border border-cyan-400/40 px-3 py-1 text-xs font-semibold text-cyan-50 hover:bg-cyan-400/10"
        >
          Target profile
        </a>
      </div>

      {!marketingReady && (
        <div className="mt-4 rounded border border-amber-900/70 bg-amber-950/30 p-3 text-xs text-amber-100">
          Marketing attribution is not available yet. The campaign workflow can
          still save drafts and learning, but source and CTA evidence will be
          incomplete.
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Section title="Campaign queue">
          <div className="space-y-3">
            {[
              'Active campaign',
              'Draft campaigns',
              'Posted/waiting campaigns',
              'Learning captured',
              'Archived',
            ].map((bucket) => {
              const bucketCampaigns = campaigns.filter(
                (item) => statusBucket(item.status) === bucket,
              )
              return (
                <div
                  key={bucket}
                  className="rounded border border-slate-800 bg-slate-950/50 p-2"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {bucket}
                  </div>
                  <div className="mt-2 space-y-2">
                    {bucketCampaigns.length === 0 ? (
                      <div className="text-xs text-slate-600">None</div>
                    ) : (
                      bucketCampaigns.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectCampaign?.(item.id)}
                          className={`w-full rounded border p-2 text-left text-xs ${
                            item.id === campaign.id
                              ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-50'
                              : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-semibold">{item.title}</div>
                          <div className="mt-1 text-slate-500">
                            {campaignStatusLabel(item.status)} · {item.angle}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        <div className="space-y-4">
          <div className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
                  Selected campaign
                </div>
                <h4 className="mt-1 text-lg font-semibold leading-6 text-slate-50">
                  {campaign.title}
                </h4>
                <div className="mt-1 text-sm text-slate-300">
                  Testing {campaign.angle} for {campaign.audience}
                </div>
              </div>
              <span className="rounded border border-cyan-300/40 bg-slate-950/40 px-2 py-1 text-xs font-semibold capitalize text-cyan-50">
                {campaignStatusLabel(campaign.status)}
              </span>
            </div>

            {hasPosted ? (
              <dl className="mt-4 grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-slate-500">Post is live</dt>
                  <dd className="mt-1 font-semibold text-slate-100">
                    {campaign.postedUrl ? (
                      <a
                        href={campaign.postedUrl}
                        className="block truncate text-cyan-50 hover:text-white"
                      >
                        {campaign.postedUrl}
                      </a>
                    ) : (
                      'URL not saved'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Posted time</dt>
                  <dd className="mt-1 font-semibold text-slate-100">
                    {formatTimestamp(campaign.postedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Check-after time</dt>
                  <dd className="mt-1 font-semibold text-slate-100">
                    {formatTimestamp(checkAfter)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Next action</dt>
                  <dd className="mt-1 font-semibold text-slate-100">
                    Record learning, then choose next campaign
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="mt-4 rounded border border-cyan-300/30 bg-slate-950/30 p-3 text-sm font-semibold text-slate-50">
                What should I publish next? Edit this draft, copy it, publish,
                then save the post URL.
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <Section title={hasPosted ? 'Posted campaign' : 'Editable draft'}>
              <div className="rounded border border-slate-800/80 bg-slate-950/60 p-3">
                <label className="text-xs text-slate-400">
                  Hook
                  <input
                    value={editFields.hook}
                    onChange={(event) => updateField('hook', event.target.value)}
                    disabled={!canPublish}
                    className="mt-1 w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-60"
                  />
                </label>
                <label className="mt-3 block text-xs text-slate-400">
                  Full post body
                  <textarea
                    value={editFields.postBody}
                    onChange={(event) =>
                      updateField('postBody', event.target.value)
                    }
                    disabled={!canPublish}
                    className="mt-1 min-h-72 w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm leading-6 text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-60"
                  />
                </label>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs text-slate-400">
                    Intended audience
                    <input
                      value={editFields.audience}
                      onChange={(event) =>
                        updateField('audience', event.target.value)
                      }
                      disabled={!canPublish}
                      className="mt-1 w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-60"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Target URL
                    <input
                      value={editFields.targetUrl}
                      onChange={(event) =>
                        updateField('targetUrl', event.target.value)
                      }
                      disabled={!canPublish}
                      className="mt-1 w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-60"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Suggested screenshot
                    <input
                      value={editFields.suggestedScreenshot}
                      onChange={(event) =>
                        updateField('suggestedScreenshot', event.target.value)
                      }
                      disabled={!canPublish}
                      className="mt-1 w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-60"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Feedback ask
                    <input
                      value={editFields.feedbackAsk}
                      onChange={(event) =>
                        updateField('feedbackAsk', event.target.value)
                      }
                      disabled={!canPublish}
                      className="mt-1 w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-60"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-xs text-slate-400">
                  Hypothesis
                  <textarea
                    value={editFields.hypothesis}
                    onChange={(event) =>
                      updateField('hypothesis', event.target.value)
                    }
                    disabled={!canPublish}
                    className="mt-1 min-h-20 w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-60"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyPost()}
                    className="rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/20"
                  >
                    Copy selected draft
                  </button>
                  {canPublish && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => onUpdateCampaign?.(campaign.id, editFields)}
                      className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save draft edits
                    </button>
                  )}
                </div>
              </div>
            </Section>

            <div className="space-y-4">
              <Section title="Angle being tested">
                <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3 text-sm text-slate-200">
                  <div className="font-semibold text-slate-100">
                    {campaign.angle}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-slate-300">
                    {campaign.hypothesis}
                  </div>
                </div>
              </Section>

              <Section title="Success metric">
                <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3 text-xs leading-5 text-slate-300">
                  Primary: real-user visits to the target profile. Secondary:
                  CTA clicks and sign-in attempts after the post.
                </div>
              </Section>

              {canPublish && (
                <Section title="Mark published">
                  <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
                    <label className="text-xs text-slate-400">
                      Posted URL
                      <input
                        value={postedUrl}
                        onChange={(event) => setPostedUrl(event.target.value)}
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                        placeholder="LinkedIn URL after publishing"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={isSaving || !postedUrl.trim()}
                      onClick={() =>
                        onMarkPosted?.({
                          campaignId: campaign.id,
                          postedUrl,
                        })
                      }
                      className="mt-3 rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mark posted
                    </button>
                  </div>
                </Section>
              )}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Section title="Record learning">
              <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
                <div className="mb-3 rounded border border-slate-800 bg-slate-900/60 p-2 text-xs text-slate-300">
                  {metricsWindowLabel}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-xs text-slate-400">
                    What happened after the last post?
                    <textarea
                      value={learningFields.learningWhatHappened}
                      onChange={(event) =>
                        setLearningFields((fields) => ({
                          ...fields,
                          learningWhatHappened: event.target.value,
                        }))
                      }
                      className="mt-1 min-h-20 w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    What was confusing?
                    <textarea
                      value={learningFields.learningWhatWasConfusing}
                      onChange={(event) =>
                        setLearningFields((fields) => ({
                          ...fields,
                          learningWhatWasConfusing: event.target.value,
                        }))
                      }
                      className="mt-1 min-h-20 w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                    />
                  </label>
                  <label className="text-xs text-slate-400 md:col-span-2">
                    Next message angle
                    <textarea
                      value={learningFields.nextMessageAngle}
                      onChange={(event) =>
                        setLearningFields((fields) => ({
                          ...fields,
                          nextMessageAngle: event.target.value,
                        }))
                      }
                      className="mt-1 min-h-20 w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                    />
                  </label>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        onSaveLearning?.({
                          campaignId: campaign.id,
                          ...learningFields,
                        })
                      }
                      className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Record learning
                    </button>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Choose next campaign">
              <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
                <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-50">
                  {recommendation}
                </div>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                  {preparedHonestFitMarketingCampaignDrafts.map((draft) => (
                    <button
                      key={draft.id}
                      type="button"
                      disabled={isSaving}
                      onClick={() => onStartNextCampaign?.(draft.id)}
                      className="rounded border border-slate-800 bg-slate-900/50 p-2 text-left text-slate-300 hover:border-cyan-500/40 hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="font-semibold text-slate-100">
                        {draft.angle}
                      </div>
                      <div className="mt-1 leading-5">{draft.hook}</div>
                    </button>
                  ))}
                </div>
                {campaign.status === 'learning_captured' && (
                  <div className="mt-3 text-xs font-semibold text-emerald-100">
                    Learning saved. Choose next campaign to create a fresh
                    active draft while preserving this history.
                  </div>
                )}
              </div>
            </Section>
          </div>

          <Section title="Previous campaign learning">
            <div className="grid gap-3 md:grid-cols-2">
              {campaigns
                .filter(
                  (item) =>
                    item.status === 'learning_captured' ||
                    item.learningWhatHappened ||
                    item.learningWhatWasConfusing,
                )
                .map((item) => (
                  <div
                    key={item.id}
                    className="rounded border border-slate-800/80 bg-slate-950/40 p-3 text-xs leading-5 text-slate-300"
                  >
                    <div className="font-semibold text-slate-100">
                      {item.title}
                    </div>
                    <div className="mt-2">
                      {item.learningWhatHappened || 'No outcome saved.'}
                    </div>
                    <div className="mt-1 text-slate-500">
                      {item.learningWhatWasConfusing ||
                        'No confusion note saved.'}
                    </div>
                    <div className="mt-2 text-cyan-100">
                      {item.nextMessageAngle || 'No next angle saved.'}
                    </div>
                  </div>
                ))}
            </div>
          </Section>

          <Section title="Supporting metrics">
            <div className="mb-2 text-xs text-slate-500">
              {metricsWindowLabel}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              {metrics.map((metric) => (
                <SignalMetric key={metric.label} {...metric} />
              ))}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
                  Traffic sources
                </div>
                <MarketingMetricList
                  items={summary.marketing?.trafficSources24h ?? []}
                  emptyLabel="No source signal yet"
                />
              </div>
              <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
                  Campaigns
                </div>
                <MarketingMetricList
                  items={summary.marketing?.campaigns24h ?? []}
                  emptyLabel="No campaign signal yet"
                />
              </div>
              <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
                  Top source
                </div>
                <div className="text-xs text-slate-300">
                  {topSource
                    ? `${metricName(topSource)}: ${formatNumber(
                        topSource.visits,
                      )}`
                    : 'No source signal yet'}
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </section>
  )
}

function Section({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h4>
      {children}
    </section>
  )
}

function BriefingList({
  title,
  items,
}: Readonly<{ title: string; items: string[] }>) {
  return (
    <section className="min-w-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h4>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-200">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function OperatorBriefingCard({
  summary,
}: Readonly<{ summary: HonestFitMissionSummary }>) {
  const briefing = buildHonestFitOperatorBriefing(summary)

  return (
    <section className="rounded-lg border border-cyan-500/30 bg-slate-950/70 p-4 shadow-[0_0_0_1px_rgba(34,211,238,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">
            Operator Briefing
          </h4>
          <div className="mt-1 text-xs text-slate-500">
            HonestFit launch status · Last 24 hours
          </div>
        </div>
        <span
          className={`rounded border px-2 py-1 text-xs font-semibold uppercase ${briefingTone(
            briefing.status,
          )}`}
        >
          {briefingLabel(briefing.status)}
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <BriefingList title="What happened" items={briefing.whatHappened} />
        <BriefingList title="What changed" items={briefing.whatChanged} />
        <BriefingList
          title="Where people got stuck"
          items={briefing.whereStuck}
        />
        <BriefingList
          title="What needs attention"
          items={briefing.needsAttention}
        />
        <BriefingList title="What can be ignored" items={briefing.canIgnore} />
      </div>
    </section>
  )
}

export function HonestFitTelemetryPanelView({
  result,
  campaignState,
  experiment,
  onMarkPosted,
  onSaveLearning,
  onUpdateCampaign,
  onStartNextCampaign,
  isExperimentSaving = false,
  isLoading = false,
  error,
}: Readonly<{
  result?: HonestFitMissionSummaryResult
  campaignState?: HonestFitMarketingCampaignState
  experiment?: HonestFitMarketingExperiment
  onMarkPosted?: (input: { campaignId: string; postedUrl: string }) => void
  onSaveLearning?: (
    input: Pick<
      HonestFitMarketingCampaign,
      | 'learningWhatHappened'
      | 'learningWhatWasConfusing'
      | 'nextMessageAngle'
    > & { campaignId: string },
  ) => void
  onUpdateCampaign?: (
    campaignId: string,
    campaign: Partial<CampaignEditFields>,
  ) => void
  onStartNextCampaign?: (draftId: string) => void
  onResetExperiment?: () => void
  isExperimentSaving?: boolean
  isLoading?: boolean
  error?: Error | null
}>) {
  const resolvedCampaignState = campaignState ?? campaignStateForView(experiment)
  const [selectedCampaignId, setSelectedCampaignId] = useState(
    resolvedCampaignState.selectedCampaignId,
  )
  useEffect(() => {
    setSelectedCampaignId(resolvedCampaignState.selectedCampaignId)
  }, [resolvedCampaignState.selectedCampaignId])
  const summary = result?.status === 'success' ? result.summary : null
  const statusLabel = summary?.health.status ?? 'unavailable'
  const panelTone = summary
    ? statusTone(summary.health.status)
    : 'border-slate-700 bg-slate-800/40 text-slate-300'

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-slate-100">
            HonestFit Launch Telemetry
          </h3>
          <div className="mt-1 text-xs text-slate-500">
            {summary
              ? `Generated ${formatTimestamp(summary.generatedAt)}`
              : 'Aggregate metrics only'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="text-xs text-slate-500">Loading...</span>
          )}
          <span
            className={`rounded border px-2 py-1 text-xs font-semibold uppercase ${panelTone}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {result?.status === 'unavailable' && (
        <div className="mt-4 rounded border border-amber-900/70 bg-amber-950/30 p-3 text-xs text-amber-100">
          Unavailable: {result.message}
        </div>
      )}

      {(result?.status === 'error' || error) && (
        <div className="mt-4 rounded border border-red-900/70 bg-red-950/30 p-3 text-xs text-red-100">
          Unable to fetch HonestFit telemetry
          {result?.status === 'error' && result.upstreamStatus
            ? ` (${result.upstreamStatus})`
            : ''}
        </div>
      )}

      {summary && (
        <div className="mt-4 space-y-5">
          <OperatorBriefingCard summary={summary} />
          <HonestFitMarketingWorkbench
            summary={summary}
            state={resolvedCampaignState}
            selectedCampaignId={selectedCampaignId}
            onSelectCampaign={setSelectedCampaignId}
            onMarkPosted={onMarkPosted}
            onSaveLearning={onSaveLearning}
            onUpdateCampaign={onUpdateCampaign}
            onStartNextCampaign={onStartNextCampaign}
            isSaving={isExperimentSaving}
          />
          <LaunchFunnelCard summary={summary} />

          <div className="grid gap-5 xl:grid-cols-3">
            <Section title="Health">
              <div
                className={`rounded border p-3 text-xs ${statusTone(summary.health.status)}`}
              >
                <div className="text-sm font-semibold uppercase">
                  {summary.health.status}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-slate-300">
                  <span>Blocking</span>
                  <span className="text-right font-mono">
                    {formatNumber(summary.health.blockingIssueCount)}
                  </span>
                  <span>Warnings</span>
                  <span className="text-right font-mono">
                    {formatNumber(summary.health.warningCount)}
                  </span>
                  {summary.health.appVersion && (
                    <>
                      <span>Version</span>
                      <span className="text-right font-mono">
                        {summary.health.appVersion}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Section>

            <Section title="Traffic 24h">
              <TrafficClassificationCard summary={summary} />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    Top pages
                  </div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {topList(summary.traffic.topPages24h, 'No page views')}
                  </ul>
                </div>
                <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    Top referrers
                  </div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {topList(summary.traffic.topReferrers24h, 'No referrers')}
                  </ul>
                </div>
              </div>
            </Section>

            <Section title="Signups">
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Free total" value={summary.signups.freeTotal} />
                <Metric label="Free 24h" value={summary.signups.free24h} />
                <Metric label="Active Pro" value={summary.signups.proActive} />
                <Metric label="Pro 24h" value={summary.signups.pro24h} />
              </div>
            </Section>

            <Section title="Funnel 24h">
              <div className="grid grid-cols-2 gap-3">
                <Metric
                  label="Magic requested"
                  value={summary.funnel.magicLinksRequested24h}
                />
                <Metric
                  label="Magic consumed"
                  value={summary.funnel.magicLinksConsumed24h}
                />
                <Metric
                  label="Profile viewed"
                  value={summary.funnel.profileViews24h}
                />
                <Metric
                  label="Capture started"
                  value={summary.funnel.captureStarted24h}
                />
                <Metric
                  label="Capture saved"
                  value={summary.funnel.captureSaved24h}
                />
                <Metric
                  label="Fit viewed"
                  value={summary.funnel.fitViewed24h}
                />
                <Metric
                  label="Fit reports"
                  value={summary.funnel.fitReportsRequested24h}
                />
                <Metric
                  label="Resume generated"
                  value={summary.funnel.resumeGenerated24h}
                />
              </div>
            </Section>

            <Section title="Errors 24h">
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Total" value={summary.errors.total24h} />
                <Metric label="Critical" value={summary.errors.critical24h} />
              </div>
              <ul className="space-y-2 text-xs">
                {summary.errors.recent.slice(0, 3).map((item) => (
                  <li
                    key={`${item.at}-${item.route}-${item.requestId ?? item.status}`}
                    className="rounded border border-red-900/50 bg-red-950/20 p-2 text-red-100"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono">{item.route}</span>
                      <span className="shrink-0 font-mono">{item.status}</span>
                    </div>
                    <div className="mt-1 truncate text-red-100/80">
                      {item.message}
                    </div>
                    {item.requestId && (
                      <div className="mt-1 truncate font-mono text-red-100/60">
                        {item.requestId}
                      </div>
                    )}
                  </li>
                ))}
                {summary.errors.recent.length === 0 && (
                  <li className="text-xs text-slate-500">No recent errors.</li>
                )}
              </ul>
            </Section>

            <Section title="Billing">
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Active Pro" value={summary.billing.activePro} />
                <Metric
                  label="Cancellations"
                  value={summary.billing.scheduledCancellations}
                />
                <Metric
                  label="Webhook events"
                  value={summary.billing.stripeWebhookEvents24h}
                />
                <Metric
                  label="Webhook failures"
                  value={summary.billing.stripeWebhookFailures24h}
                />
              </div>
              <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3 text-xs">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Last webhook
                </div>
                <div className="mt-1 text-slate-200">
                  {formatTimestamp(summary.billing.lastStripeWebhookAt)}
                </div>
              </div>
            </Section>
          </div>
        </div>
      )}
    </div>
  )
}

export function HonestFitTelemetryPanel() {
  const queryClient = useQueryClient()
  const experimentQuery = useQuery({
    queryKey: ['honestfit-marketing-experiment'],
    queryFn: fetchHonestFitMarketingExperiment,
  })
  const campaignState = experimentQuery.data
  const selectedCampaign = campaignState?.campaigns.find(
    (campaign) => campaign.id === campaignState.selectedCampaignId,
  )
  const telemetrySince =
    selectedCampaign?.status === 'waiting_for_data' ||
    selectedCampaign?.status === 'learning_captured' ||
    selectedCampaign?.status === 'posted'
      ? selectedCampaign.postedAt
      : null
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['honestfit-mission-summary', telemetrySince],
    queryFn: () => fetchHonestFitTelemetry(telemetrySince),
    refetchInterval: 60_000,
    enabled: !experimentQuery.isLoading,
  })
  const experimentMutation = useMutation({
    mutationFn: patchHonestFitMarketingExperiment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['honestfit-marketing-experiment'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['honestfit-mission-summary'],
      })
    },
  })

  return (
    <div className="space-y-2">
      <HonestFitTelemetryPanelView
        result={data}
        campaignState={campaignState}
        onMarkPosted={({ campaignId, postedUrl }) =>
          experimentMutation.mutate({
            action: 'mark_posted',
            campaignId,
            postedUrl,
          })
        }
        onSaveLearning={(learning) =>
          experimentMutation.mutate({ action: 'save_learning', ...learning })
        }
        onUpdateCampaign={(campaignId, campaign) =>
          experimentMutation.mutate({ action: 'update', campaignId, campaign })
        }
        onStartNextCampaign={(draftId) =>
          experimentMutation.mutate({ action: 'start_next_campaign', draftId })
        }
        isExperimentSaving={experimentMutation.isPending}
        isLoading={isLoading || isFetching || experimentQuery.isLoading}
        error={(error || experimentQuery.error) as Error | null}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            void experimentQuery.refetch()
            void refetch()
          }}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
