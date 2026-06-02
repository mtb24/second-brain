import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowLeft,
  LineChart as LineChartIcon,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Temporal } from '@js-temporal/polyfill'
import type { BodyMetricEntry, StrengthTrendEntry } from '@/server/workout/types'
import { formatBodyPartLabel } from '@/workout/body-measurements'

export const Route = createFileRoute('/workout_/metrics')({
  component: WorkoutMetricsPage,
})

type BodyMetricResponse = {
  metrics: BodyMetricEntry[]
}

type StrengthTrendResponse = {
  trends: StrengthTrendEntry[]
}

type MeasurementSummary = {
  bodyPart: string
  count: number
  first: BodyMetricEntry
  latest: BodyMetricEntry
  change: number
}

type StrengthSummary = {
  exerciseName: string
  count: number
  first: StrengthTrendEntry
  latest: StrengthTrendEntry
  change: number
}

type TrendPoint = {
  date: string
  label: string
  value: number
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}

function WorkoutMetricsPage() {
  const [selectedPart, setSelectedPart] = useState('')
  const [selectedExercise, setSelectedExercise] = useState('')
  const metricsQuery = useQuery({
    queryKey: ['workout-body-metrics', 'history'],
    queryFn: () => api<BodyMetricResponse>('/api/workout/body-metrics?limit=240'),
  })
  const strengthQuery = useQuery({
    queryKey: ['workout-strength-trends', 'history'],
    queryFn: () => api<StrengthTrendResponse>('/api/workout/strength-trends?limit=240'),
  })

  const measurements = useMemo(
    () => (metricsQuery.data?.metrics ?? [])
      .filter((metric) => metric.metricType === 'measurement' && metric.bodyPart)
      .sort(compareMetricDates),
    [metricsQuery.data?.metrics],
  )
  const bodyCompositionMetrics = useMemo(
    () => (metricsQuery.data?.metrics ?? [])
      .filter((metric) => metric.metricType === 'bodyweight' || metric.metricType === 'bodyfat')
      .sort(compareMetricDates),
    [metricsQuery.data?.metrics],
  )
  const bodyFatMetrics = bodyCompositionMetrics.filter((metric) => metric.metricType === 'bodyfat')
  const bodyWeightMetrics = bodyCompositionMetrics.filter((metric) => metric.metricType === 'bodyweight')
  const bodyFatChartData = buildMetricChartData(bodyFatMetrics)
  const bodyWeightChartData = buildMetricChartData(bodyWeightMetrics)

  const summaries = useMemo(() => buildMeasurementSummaries(measurements), [measurements])
  const selectedSummary = summaries.find((summary) => summary.bodyPart === selectedPart) ?? summaries[0] ?? null
  const selectedMetrics = selectedSummary
    ? measurements.filter((metric) => normalizeBodyPart(metric.bodyPart) === selectedSummary.bodyPart)
    : []
  const chartData = selectedMetrics.map((metric) => ({
    date: metric.measuredAt,
    label: formatShortDate(metric.measuredAt),
    value: metric.value,
  }))

  const strengthTrends = useMemo(
    () => (strengthQuery.data?.trends ?? []).slice().sort(compareStrengthDates),
    [strengthQuery.data?.trends],
  )
  const strengthSummaries = useMemo(() => buildStrengthSummaries(strengthTrends), [strengthTrends])
  const selectedStrengthSummary = strengthSummaries.find((summary) => summary.exerciseName === selectedExercise) ?? strengthSummaries[0] ?? null
  const selectedStrengthTrends = selectedStrengthSummary
    ? strengthTrends.filter((trend) => trend.exerciseName === selectedStrengthSummary.exerciseName)
    : []
  const strengthChartData = selectedStrengthTrends.map((trend) => ({
    date: trend.performedDate,
    label: formatShortDate(trend.performedDate),
    value: trend.estimated1Rm,
  }))

  if (metricsQuery.isLoading || strengthQuery.isLoading) {
    return <div className="text-sm text-slate-300">Loading body metrics...</div>
  }

  if (metricsQuery.error || strengthQuery.error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-100">
        Metric history is not available.
      </div>
    )
  }

  return (
    <div className="space-y-5 text-base md:text-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            to="/workout"
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Workout
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-white md:text-3xl">Body Metrics</h1>
          <p className="mt-1 text-sm text-slate-300">Measurement trends and growth history</p>
        </div>
      </div>

      <Panel title="Body Composition" icon={<Activity className="h-4 w-4" />}>
        {!bodyCompositionMetrics.length ? (
          <div className="flex min-h-56 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/50 text-sm text-slate-400">
            No bodyweight or body fat entries logged yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <MetricTrendCard
              title="Body Fat"
              latest={bodyFatMetrics.at(-1) ?? null}
              data={bodyFatChartData}
              unit="%"
              valueLabel="Body Fat"
              stroke="#f59e0b"
              emptyText="No body fat entries logged yet."
            />
            <MetricTrendCard
              title="Bodyweight"
              latest={bodyWeightMetrics.at(-1) ?? null}
              data={bodyWeightChartData}
              unit={bodyWeightMetrics.at(-1)?.unit ?? ''}
              valueLabel="Bodyweight"
              stroke="#94a3b8"
              emptyText="No bodyweight entries logged yet."
            />
          </div>
        )}
      </Panel>

      <Panel title="Body Part Growth" icon={<LineChartIcon className="h-4 w-4" />}>
        {!summaries.length ? (
          <div className="flex min-h-56 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/50 text-sm text-slate-400">
            No body measurements logged yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-2">
              {summaries.map((summary) => (
                <button
                  key={summary.bodyPart}
                  type="button"
                  onClick={() => setSelectedPart(summary.bodyPart)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition ${
                    selectedSummary?.bodyPart === summary.bodyPart
                      ? 'border-emerald-400 bg-emerald-950/30'
                      : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-white">{formatBodyPartLabel(summary.bodyPart)}</span>
                    <span className={summary.change >= 0 ? 'text-emerald-300' : 'text-amber-300'}>
                      {formatSigned(summary.change)} {summary.latest.unit}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {summary.latest.value} {summary.latest.unit} latest · {summary.count} entries
                  </div>
                </button>
              ))}
            </div>

            <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {selectedSummary ? formatBodyPartLabel(selectedSummary.bodyPart) : 'Measurement'}
                  </div>
                  {selectedSummary && (
                    <div className="text-xs text-slate-400">
                      {selectedSummary.first.measuredAt} to {selectedSummary.latest.measuredAt}
                    </div>
                  )}
                </div>
                {selectedSummary && (
                  <div className="text-sm font-semibold text-emerald-300">
                    {selectedSummary.latest.value} {selectedSummary.latest.unit}
                  </div>
                )}
              </div>
              <TrendLineChart
                data={chartData}
                unit={selectedSummary?.latest.unit ?? ''}
                valueLabel="Measurement"
                stroke="#34d399"
              />
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Strength Changes" icon={<LineChartIcon className="h-4 w-4" />}>
        {!strengthSummaries.length ? (
          <div className="flex min-h-56 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/50 text-sm text-slate-400">
            No working sets logged yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-2">
              {strengthSummaries.map((summary) => (
                <button
                  key={summary.exerciseName}
                  type="button"
                  onClick={() => setSelectedExercise(summary.exerciseName)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition ${
                    selectedStrengthSummary?.exerciseName === summary.exerciseName
                      ? 'border-sky-400 bg-sky-950/30'
                      : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold text-white">{summary.exerciseName}</span>
                    <span className={summary.change >= 0 ? 'text-emerald-300' : 'text-amber-300'}>
                      {formatSigned(summary.change)} {summary.latest.unit}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {summary.latest.estimated1Rm} {summary.latest.unit} e1RM · {summary.count} sets
                  </div>
                </button>
              ))}
            </div>

            <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {selectedStrengthSummary?.exerciseName ?? 'Exercise'}
                  </div>
                  {selectedStrengthSummary && (
                    <div className="text-xs text-slate-400">
                      {selectedStrengthSummary.first.performedDate} to {selectedStrengthSummary.latest.performedDate}
                    </div>
                  )}
                </div>
                {selectedStrengthSummary && (
                  <div className="text-sm font-semibold text-sky-300">
                    {selectedStrengthSummary.latest.estimated1Rm} {selectedStrengthSummary.latest.unit} e1RM
                  </div>
                )}
              </div>
              <TrendLineChart
                data={strengthChartData}
                unit={selectedStrengthSummary?.latest.unit ?? ''}
                valueLabel="Estimated 1RM"
                stroke="#38bdf8"
              />
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Recent Body Metrics" icon={<Activity className="h-4 w-4" />}>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {(metricsQuery.data?.metrics ?? []).slice(0, 18).map((metric) => (
            <div key={metric.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-950/70 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-slate-200">
                {formatBodyMetricLabel(metric)} · {metric.measuredAt}
              </span>
              <span className="shrink-0 font-semibold text-white">
                {metric.value} {metric.unit}
              </span>
            </div>
          ))}
          {(metricsQuery.data?.metrics ?? []).length === 0 && (
            <div className="text-sm text-slate-400">No body metrics logged yet.</div>
          )}
        </div>
      </Panel>
    </div>
  )
}

function MetricTrendCard({
  title,
  latest,
  data,
  unit,
  valueLabel,
  stroke,
  emptyText,
}: {
  title: string
  latest: BodyMetricEntry | null
  data: TrendPoint[]
  unit: string
  valueLabel: string
  stroke: string
  emptyText: string
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          {latest && (
            <div className="text-xs text-slate-400">
              Latest on {latest.measuredAt}
            </div>
          )}
        </div>
        {latest && (
          <div className="text-sm font-semibold text-white">
            {latest.value} {latest.unit}
          </div>
        )}
      </div>
      {data.length ? (
        <TrendLineChart
          data={data}
          unit={unit}
          valueLabel={valueLabel}
          stroke={stroke}
        />
      ) : (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-400">
          {emptyText}
        </div>
      )}
    </div>
  )
}

function TrendLineChart({
  data,
  unit,
  valueLabel,
  stroke,
}: {
  data: TrendPoint[]
  unit: string
  valueLabel: string
  stroke: string
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#64748b', fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: '#1e293b' }}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={42}
        />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#94a3b8' }}
          formatter={(value) => [`${Number(value).toFixed(2)} ${unit}`, valueLabel]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          dot={{ r: 3, fill: stroke }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
        {icon}
        {title}
      </div>
      {children}
    </section>
  )
}

function buildMeasurementSummaries(metrics: BodyMetricEntry[]): MeasurementSummary[] {
  const byPart = new Map<string, BodyMetricEntry[]>()
  for (const metric of metrics) {
    const bodyPart = normalizeBodyPart(metric.bodyPart)
    if (!bodyPart) continue
    byPart.set(bodyPart, [...(byPart.get(bodyPart) ?? []), metric])
  }

  return [...byPart.entries()]
    .map(([bodyPart, entries]) => {
      const sorted = entries.slice().sort(compareMetricDates)
      const first = sorted[0]
      const latest = sorted[sorted.length - 1]
      return {
        bodyPart,
        count: sorted.length,
        first,
        latest,
        change: latest.value - first.value,
      }
    })
    .sort((a, b) => formatBodyPartLabel(a.bodyPart).localeCompare(formatBodyPartLabel(b.bodyPart)))
}

function buildStrengthSummaries(trends: StrengthTrendEntry[]): StrengthSummary[] {
  const byExercise = new Map<string, StrengthTrendEntry[]>()
  for (const trend of trends) {
    byExercise.set(trend.exerciseName, [...(byExercise.get(trend.exerciseName) ?? []), trend])
  }

  return [...byExercise.entries()]
    .map(([exerciseName, entries]) => {
      const sorted = entries.slice().sort(compareStrengthDates)
      const first = sorted[0]
      const latest = sorted[sorted.length - 1]
      return {
        exerciseName,
        count: sorted.length,
        first,
        latest,
        change: latest.estimated1Rm - first.estimated1Rm,
      }
    })
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName))
}

function buildMetricChartData(metrics: BodyMetricEntry[]): TrendPoint[] {
  return metrics.map((metric) => ({
    date: metric.measuredAt,
    label: formatShortDate(metric.measuredAt),
    value: metric.value,
  }))
}

function compareMetricDates(a: BodyMetricEntry, b: BodyMetricEntry) {
  return Temporal.PlainDate.compare(
    Temporal.PlainDate.from(a.measuredAt),
    Temporal.PlainDate.from(b.measuredAt),
  )
}

function compareStrengthDates(a: StrengthTrendEntry, b: StrengthTrendEntry) {
  return Temporal.PlainDate.compare(
    Temporal.PlainDate.from(a.performedDate),
    Temporal.PlainDate.from(b.performedDate),
  )
}

function formatShortDate(value: string) {
  const date = Temporal.PlainDate.from(value)
  return `${date.month}/${date.day}`
}

function normalizeBodyPart(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function formatSigned(value: number) {
  const rounded = Math.round(value * 100) / 100
  return rounded > 0 ? `+${rounded}` : String(rounded)
}

function formatBodyMetricLabel(metric: BodyMetricEntry) {
  if (metric.metricType === 'bodyweight') return 'Bodyweight'
  if (metric.metricType === 'bodyfat') return 'Body Fat'
  return formatBodyPartLabel(metric.bodyPart ?? metric.metricType)
}
