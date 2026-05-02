import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  buildHonestFitOperatorBriefing,
  type HonestFitOperatorBriefingStatus,
} from '@/server/honestFitOperatorBriefing'
import type {
  HonestFitMissionSummary,
  HonestFitMissionSummaryResult,
} from '@/server/honestFitMissionSummary'

async function fetchHonestFitTelemetry(): Promise<HonestFitMissionSummaryResult> {
  const res = await fetch('/api/honestfit/mission-summary', {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error('Unable to load HonestFit telemetry')
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

type MarketingAction = {
  priority: 'high' | 'medium' | 'low'
  action: string
  why: string
  channel: string
}

function buildLaunchFunnelSteps(
  summary: HonestFitMissionSummary,
): FunnelStep[] {
  return [
    {
      label: 'Site visits',
      phrase: 'site visits',
      value: summary.traffic.pageViews24h,
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
  const signInStarted = steps[1]?.value ?? 0
  const signedIn = steps[2]?.value ?? 0
  const profileViewed = steps[3]?.value ?? 0
  const captureStarted = steps[4]?.value ?? 0
  const captureSaved = steps[5]?.value ?? 0
  const fitViewed = steps[6]?.value ?? 0
  const fitReportAction = steps[7]?.value ?? 0

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
  const sourceVisits =
    summary.marketing?.trafficSources24h.reduce(
      (total, item) => total + item.visits,
      0,
    ) ?? 0

  return Math.max(sourceVisits, summary.traffic.pageViews24h)
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

function hasMarketingActivity(summary: HonestFitMissionSummary) {
  return (
    marketingTrafficTotal(summary) > 0 ||
    totalCtaClicks(summary) > 0 ||
    (summary.marketing?.campaigns24h.length ?? 0) > 0 ||
    (summary.marketing?.topReferrers24h.length ?? 0) > 0
  )
}

function buildFunnelDiagnosis(summary: HonestFitMissionSummary) {
  const traffic = marketingTrafficTotal(summary)
  const ctaClicks = totalCtaClicks(summary)
  const signInStarted = summary.funnel.magicLinksRequested24h
  const signedIn = summary.funnel.magicLinksConsumed24h
  const signups = summary.signups.free24h + summary.signups.pro24h
  const captureStarted = summary.funnel.captureStarted24h

  return [
    {
      label: 'Traffic but no CTA clicks',
      active: traffic > 0 && ctaClicks === 0,
    },
    {
      label: 'CTA clicks but no sign-in',
      active: ctaClicks > 0 && signInStarted === 0,
    },
    {
      label: 'Sign-in attempts but no completions',
      active: signInStarted > 0 && signedIn === 0,
    },
    {
      label: 'Signups but no capture',
      active: signups > 0 && captureStarted === 0,
    },
  ]
}

function buildMarketingActions(summary: HonestFitMissionSummary) {
  const traffic = marketingTrafficTotal(summary)
  const ctaClicks = totalCtaClicks(summary)
  const signInStarted = summary.funnel.magicLinksRequested24h
  const signedIn = summary.funnel.magicLinksConsumed24h
  const signups = summary.signups.free24h + summary.signups.pro24h
  const topSource = topMarketingSource(summary)
  const topSourceName = topSource ? metricName(topSource) : 'Unknown'
  const topSourceLower = topSourceName.toLowerCase()
  const partnerApiClicks = summary.marketing?.cta24h.partnerApiEmailClicks ?? 0
  const actions: MarketingAction[] = []

  if (!hasMarketingFields(summary)) {
    return [
      {
        priority: 'high' as const,
        action:
          'Finish wiring HonestFit marketing attribution into the Mission summary.',
        why: 'Mission is receiving launch telemetry, but marketing source fields are not present yet.',
        channel: 'Mission setup',
      },
    ]
  }

  if (traffic === 0) {
    actions.push({
      priority: 'high',
      action: 'Traffic is the constraint: publish/comment again today.',
      why: 'No marketing visits are visible in the current window.',
      channel: 'LinkedIn',
    })
  }

  if (traffic > 0 && ctaClicks === 0) {
    actions.push({
      priority: 'high',
      action: 'Make the next post about the exact problem HonestFit solves.',
      why: 'Traffic arrived, but no CTA clicks were recorded.',
      channel: topSourceName,
    })
  }

  if (ctaClicks > 0 && signInStarted === 0) {
    actions.push({
      priority: 'high',
      action: 'CTA clicks but no signups: inspect login/sign-in copy.',
      why: 'People clicked a CTA, but no sign-in links were requested.',
      channel: 'HonestFit site',
    })
  }

  if (signInStarted > 0 && signedIn === 0) {
    actions.push({
      priority: 'high',
      action:
        'Check the magic-link completion path before sending more traffic.',
      why: 'Sign-in attempts started, but none completed.',
      channel: 'HonestFit site',
    })
  }

  if (topSourceLower.includes('linkedin') && traffic > 0) {
    actions.push({
      priority: 'high',
      action:
        'LinkedIn is the strongest source: reply to comments and DM relevant engagers.',
      why: 'LinkedIn is the strongest known source in the current window.',
      channel: 'LinkedIn',
    })
  }

  if (signups === 0) {
    actions.push({
      priority: 'medium',
      action:
        'No signups yet: make the next post about the exact problem HonestFit solves.',
      why: 'Launch telemetry shows zero signups in the current window.',
      channel: topSourceName === 'Unknown' ? 'LinkedIn' : topSourceName,
    })
  }

  if (signups > 0 && summary.funnel.captureStarted24h === 0) {
    actions.push({
      priority: 'high',
      action: 'Walk the first-user capture path and tighten the first screen.',
      why: 'Signups happened, but no capture started.',
      channel: 'HonestFit site',
    })
  }

  if (partnerApiClicks > 0) {
    actions.push({
      priority: 'high',
      action:
        'Partner API interest detected: follow up with API/ATS/recruiter angle.',
      why: `${formatNumber(partnerApiClicks)} Partner API email click${
        partnerApiClicks === 1 ? '' : 's'
      } landed in the current window.`,
      channel: 'Email',
    })
  }

  return actions.slice(0, 5)
}

function buildContentPrompts(summary: HonestFitMissionSummary) {
  const topSource = topMarketingSource(summary)
  const channel = topSource ? metricName(topSource) : 'LinkedIn'
  const signups = summary.signups.free24h + summary.signups.pro24h

  return [
    signups === 0
      ? `Zero signups angle: what I changed after launching HonestFit to almost no traffic and zero signups.`
      : `Signup signal angle: what the first HonestFit signups are testing next.`,
    `Profile-before-resume angle: why the profile should become the source of truth before rewriting a resume.`,
    `Voice-first angle: capture career proof by talking it out before polishing documents.`,
    `Build-in-public launch lesson: what ${channel} traffic taught me about the HonestFit launch.`,
    `Explainable fit angle: show why a role fits instead of hiding behind a matching score.`,
  ]
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

function HonestFitMarketingCommandCenter({
  summary,
}: Readonly<{ summary: HonestFitMissionSummary }>) {
  const topSource = topMarketingSource(summary)
  const topSourceLabel = topSource ? metricName(topSource) : 'No source yet'
  const bestCta = topCta(summary)
  const signups = summary.signups.free24h + summary.signups.pro24h
  const actions = buildMarketingActions(summary)
  const recommended = actions[0]
  const diagnosis = buildFunnelDiagnosis(summary)
  const prompts = buildContentPrompts(summary)
  const marketingReady = hasMarketingFields(summary)
  const hasActivity = hasMarketingActivity(summary)

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">
            HonestFit Marketing Command Center
          </h4>
          <div className="mt-1 text-xs text-slate-500">
            Aggregate attribution and deterministic daily actions
          </div>
        </div>
        <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-semibold uppercase text-cyan-100">
          Daily
        </span>
      </div>

      {!marketingReady && (
        <div className="mt-4 rounded border border-amber-900/70 bg-amber-950/30 p-3 text-xs text-amber-100">
          Marketing attribution is not available yet. Once HonestFit exposes
          source, campaign, and CTA fields, this section will show channel
          performance and next actions.
        </div>
      )}

      {marketingReady && !hasActivity && (
        <div className="mt-4 rounded border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300">
          No marketing traffic is visible in the current window.
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Top channel" value={topSource?.visits ?? 0} />
        <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Best CTA
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-100">
            {formatNumber(bestCta?.value ?? 0)}
          </div>
          <div className="mt-1 truncate text-xs text-slate-500">
            {bestCta?.label ?? 'No CTA yet'}
          </div>
        </div>
        <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Signup pressure
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-100">
            {signups === 0 ? 'Zero' : formatNumber(signups)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {signups === 0 ? 'No signups yet' : 'Signups in window'}
          </div>
        </div>
        <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Recommended next move
          </div>
          <div className="mt-1 text-sm font-semibold leading-5 text-slate-100">
            {recommended?.action ?? 'Keep watching attribution.'}
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Top channel: {topSourceLabel}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Section title="Traffic sources">
          <div className="space-y-3">
            <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
                Visits by source
              </div>
              <MarketingMetricList
                items={summary.marketing?.trafficSources24h ?? []}
                emptyLabel="No source visits"
              />
            </div>
            <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
                Top referrers
              </div>
              <MarketingMetricList
                items={summary.marketing?.topReferrers24h ?? []}
                emptyLabel="No referrers"
              />
            </div>
            <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
                Campaigns
              </div>
              <MarketingMetricList
                items={summary.marketing?.campaigns24h ?? []}
                emptyLabel="No campaigns"
              />
            </div>
          </div>
        </Section>

        <Section title="CTA performance">
          <div className="grid gap-3">
            {ctaMetrics(summary).map((item) => (
              <Metric key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </Section>

        <Section title="Funnel diagnosis">
          <ul className="space-y-2 text-xs">
            {diagnosis.map((item) => (
              <li
                key={item.label}
                className={`rounded border p-2 ${
                  item.active
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                    : 'border-slate-800/80 bg-slate-950/40 text-slate-500'
                }`}
              >
                {item.label}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Section title="Suggested actions">
          <ul className="space-y-2 text-xs">
            {actions.map((item) => (
              <li
                key={`${item.priority}-${item.action}`}
                className="rounded border border-slate-800/80 bg-slate-900/50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">
                    {item.action}
                  </span>
                  <span className="rounded border border-slate-700 px-2 py-0.5 font-semibold uppercase text-slate-300">
                    {item.priority}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-slate-400 md:grid-cols-[1fr_140px]">
                  <span>{item.why}</span>
                  <span className="font-medium text-cyan-100">
                    {item.channel}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Content prompts">
          <ul className="space-y-2 text-xs leading-5 text-slate-200">
            {prompts.map((prompt) => (
              <li
                key={prompt}
                className="rounded border border-slate-800/80 bg-slate-950/40 p-2"
              >
                {prompt}
              </li>
            ))}
          </ul>
        </Section>
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
  isLoading = false,
  error,
}: Readonly<{
  result?: HonestFitMissionSummaryResult
  isLoading?: boolean
  error?: Error | null
}>) {
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
          <LaunchFunnelCard summary={summary} />
          <HonestFitMarketingCommandCenter summary={summary} />

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
              <Metric label="Page views" value={summary.traffic.pageViews24h} />
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
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['honestfit-mission-summary'],
    queryFn: fetchHonestFitTelemetry,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-2">
      <HonestFitTelemetryPanelView
        result={data}
        isLoading={isLoading || isFetching}
        error={error as Error | null}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
