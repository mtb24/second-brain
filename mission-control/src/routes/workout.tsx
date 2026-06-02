import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  BarChart3,
  Check,
  Dumbbell,
  FastForward,
  Gauge,
  MessageSquareText,
  Play,
  Plus,
  Ruler,
  Scale,
  Send,
  SkipForward,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import type {
  BodyMetricEntry,
  ChatCommandResult,
  ExercisePerformance,
  WorkoutDashboard,
  WorkoutSession,
} from '@/server/workout/types'
import { bodyMeasurementParts, formatBodyPartLabel } from '@/workout/body-measurements'

export const Route = createFileRoute('/workout')({
  component: WorkoutPage,
})

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return res.json() as Promise<T>
}

function WorkoutPage() {
  const queryClient = useQueryClient()
  const [selectedPerformanceId, setSelectedPerformanceId] = useState<string | null>(null)
  const [setReps, setSetReps] = useState('10')
  const [setLoad, setSetLoad] = useState('')
  const [setRpe, setSetRpe] = useState('')
  const [bodyWeight, setBodyWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [measurementDate, setMeasurementDate] = useState('')
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({})
  const [chatText, setChatText] = useState('')
  const [chatResult, setChatResult] = useState<ChatCommandResult | null>(null)

  const dashboard = useQuery({
    queryKey: ['workout-dashboard'],
    queryFn: () => api<WorkoutDashboard>('/api/workout/dashboard'),
    refetchInterval: 15_000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['workout-dashboard'] })

  const generatePlan = useMutation({
    mutationFn: () => api('/api/workout/plan/generate', { method: 'POST', body: '{}' }),
    onSuccess: invalidate,
  })

  const startSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api(`/api/workout/sessions/${sessionId}/start`, { method: 'POST', body: '{}' }),
    onSuccess: invalidate,
  })

  const completeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api(`/api/workout/sessions/${sessionId}/complete`, { method: 'POST', body: '{}' }),
    onSuccess: invalidate,
  })

  const skipSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api(`/api/workout/sessions/${sessionId}/skip`, { method: 'POST', body: '{}' }),
    onSuccess: invalidate,
  })

  const logSetMutation = useMutation({
    mutationFn: (performanceId: string) => api(`/api/workout/exercise-performances/${performanceId}/sets`, {
      method: 'POST',
      body: JSON.stringify({
        reps: Number(setReps),
        load: setLoad ? Number(setLoad) : null,
        rpe: setRpe ? Number(setRpe) : null,
        unit: dashboard.data?.profile.preferredUnits ?? 'lb',
        source: 'ui',
      }),
    }),
    onSuccess: () => {
      setSetRpe('')
      invalidate()
    },
  })

  const logBodyMetricMutation = useMutation({
    mutationFn: async (body: Record<string, unknown> | Array<Record<string, unknown>>) => {
      const entries = Array.isArray(body) ? body : [body]
      return Promise.all(entries.map((entry) => api('/api/workout/body-metrics', {
        method: 'POST',
        body: JSON.stringify({ ...entry, source: 'ui' }),
      })))
    },
    onSuccess: invalidate,
  })

  const updateMeasurementValue = (bodyPart: string, value: string) => {
    setMeasurementValues((current) => ({
      ...current,
      [bodyPart]: value,
    }))
  }

  const hasMeasurementsToSave = bodyMeasurementParts.some((bodyPart) => {
    const value = Number(measurementValues[bodyPart])
    return Number.isFinite(value) && value > 0
  })

  const chatMutation = useMutation({
    mutationFn: (text: string) => api<ChatCommandResult>('/api/workout/chat/command', {
      method: 'POST',
      body: JSON.stringify({ text, source: 'ui' }),
    }),
    onSuccess: (result) => {
      setChatResult(result)
      setChatText('')
      invalidate()
    },
  })

  const currentSession = dashboard.data?.todaySession ?? dashboard.data?.nextSession ?? null
  const activePerformance = useMemo(() => {
    if (!currentSession) return null
    if (selectedPerformanceId) {
      const selected = currentSession.performances.find((item) => item.id === selectedPerformanceId)
      if (selected) return selected
    }
    return dashboard.data?.activePerformance ?? currentSession.performances[0] ?? null
  }, [currentSession, dashboard.data?.activePerformance, selectedPerformanceId])

  if (dashboard.isLoading) {
    return <div className="text-sm text-slate-300">Loading workout dashboard...</div>
  }

  if (dashboard.error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-100">
        Workout data is not available. Run the workout migration and seed scripts, then reload.
      </div>
    )
  }

  const data = dashboard.data
  if (!data) return null
  const preferredUnits = data.profile.preferredUnits

  const sessionTitle = currentSession
    ? `${currentSession.routineDayLabel ?? 'Workout'}`
    : 'No session planned'

  function submitSet(event: FormEvent) {
    event.preventDefault()
    if (!activePerformance) return
    logSetMutation.mutate(activePerformance.id)
  }

  function submitBodyWeight(event: FormEvent) {
    event.preventDefault()
    if (!bodyWeight) return
    logBodyMetricMutation.mutate({
      metricType: 'bodyweight',
      bodyPart: null,
      value: Number(bodyWeight),
      unit: preferredUnits,
    }, {
      onSuccess: () => setBodyWeight(''),
    })
  }

  function submitBodyFat(event: FormEvent) {
    event.preventDefault()
    const value = Number(bodyFat)
    if (!Number.isFinite(value) || value <= 0) return
    logBodyMetricMutation.mutate({
      metricType: 'bodyfat',
      bodyPart: null,
      value,
      unit: '%',
    }, {
      onSuccess: () => setBodyFat(''),
    })
  }

  function submitMeasurements(event: FormEvent) {
    event.preventDefault()
    const unit = preferredUnits === 'kg' ? 'cm' : 'in'
    const measuredAt = measurementDate || dashboard.data?.today
    const entries = bodyMeasurementParts.flatMap((bodyPart) => {
      const value = Number(measurementValues[bodyPart])
      if (!Number.isFinite(value) || value <= 0) return []
      return [{
        metricType: 'measurement',
        bodyPart,
        value,
        unit,
        measuredAt,
      }]
    })
    if (!entries.length) return
    logBodyMetricMutation.mutate(entries, {
      onSuccess: () => setMeasurementValues({}),
    })
  }

  function submitChat(event: FormEvent) {
    event.preventDefault()
    if (!chatText.trim()) return
    chatMutation.mutate(chatText)
  }

  return (
    <div className="space-y-5 text-base md:text-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">Workout</h1>
          <p className="mt-1 text-sm text-slate-300">
            {data.today} · {data.profile.goalType.replaceAll('_', ' ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IconButton
            icon={<FastForward className="h-4 w-4" />}
            label="Generate week"
            onClick={() => generatePlan.mutate()}
            disabled={generatePlan.isPending}
          />
          {currentSession && currentSession.status === 'planned' && (
            <IconButton
              icon={<Play className="h-4 w-4" />}
              label="Start"
              onClick={() => startSessionMutation.mutate(currentSession.id)}
              disabled={startSessionMutation.isPending}
            />
          )}
          {currentSession && currentSession.status !== 'completed' && (
            <IconButton
              icon={<Check className="h-4 w-4" />}
              label="Complete"
              onClick={() => completeSessionMutation.mutate(currentSession.id)}
              disabled={completeSessionMutation.isPending}
            />
          )}
          {currentSession && currentSession.status !== 'skipped' && (
            <IconButton
              icon={<SkipForward className="h-4 w-4" />}
              label="Skip"
              onClick={() => skipSessionMutation.mutate(currentSession.id)}
              disabled={skipSessionMutation.isPending}
            />
          )}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <section className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-300">
                <Dumbbell className="h-4 w-4" />
                Today / Next
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-white">{sessionTitle}</h2>
              {currentSession ? (
                <p className="mt-1 text-sm text-slate-300">
                  {currentSession.scheduledFor} · {currentSession.status.replaceAll('_', ' ')}
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-300">Generate the week to create planned sessions.</p>
              )}
            </div>
            {activePerformance && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-left">
                <div className="text-xs uppercase tracking-wide text-emerald-300">Current</div>
                <div className="text-lg font-semibold text-white">{activePerformance.exerciseName}</div>
                <div className="text-sm text-slate-300">
                  {activePerformance.prescribedSets}x{activePerformance.prescribedRepsMin}-{activePerformance.prescribedRepsMax}
                  {activePerformance.suggestedLoad ? ` · ${activePerformance.suggestedLoad} ${data.profile.preferredUnits}` : ''}
                </div>
              </div>
            )}
          </div>

          <GymCommandPanel
            activePerformance={activePerformance}
            chatText={chatText}
            chatResult={chatResult}
            pending={chatMutation.isPending}
            onTextChange={setChatText}
            onSubmit={submitChat}
          />

          {activePerformance && (
            <form onSubmit={submitSet} className="mt-4 grid gap-3 rounded-lg border border-slate-700 bg-slate-950/60 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Field label="Reps">
                <input
                  className="input-lg"
                  inputMode="numeric"
                  value={setReps}
                  onChange={(event) => setSetReps(event.target.value)}
                />
              </Field>
              <Field label={`Load (${data.profile.preferredUnits})`}>
                <input
                  className="input-lg"
                  inputMode="decimal"
                  placeholder={activePerformance.suggestedLoad ? String(activePerformance.suggestedLoad) : ''}
                  value={setLoad}
                  onChange={(event) => setSetLoad(event.target.value)}
                />
              </Field>
              <Field label="RPE">
                <input
                  className="input-lg"
                  inputMode="decimal"
                  placeholder="8"
                  value={setRpe}
                  onChange={(event) => setSetRpe(event.target.value)}
                />
              </Field>
              <button
                type="submit"
                className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-base font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={logSetMutation.isPending}
              >
                <Plus className="h-5 w-5" />
                Log set
              </button>
            </form>
          )}

          {activePerformance?.decision.explanation && (
            <div className="mt-3 rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
              {activePerformance.decision.explanation}
              {Array.isArray(activePerformance.decision.warnings) && activePerformance.decision.warnings.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-200">
                  {activePerformance.decision.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {currentSession && (
            <div className="mt-4 grid gap-2">
              {currentSession.performances.map((performance) => (
                <MovementRow
                  key={performance.id}
                  performance={performance}
                  selected={performance.id === activePerformance?.id}
                  unit={data.profile.preferredUnits}
                  onSelect={() => setSelectedPerformanceId(performance.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0 space-y-4">
          <Panel title="Body Metrics" icon={<Scale className="h-4 w-4" />}>
            <div className="mb-3 flex justify-end">
              <Link
                to="/workout/metrics"
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                View trends
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <form onSubmit={submitBodyWeight} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Field label={`Bodyweight (${data.profile.preferredUnits})`}>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={bodyWeight}
                    onChange={(event) => setBodyWeight(event.target.value)}
                  />
                </Field>
                <button
                  className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-600 px-3 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={logBodyMetricMutation.isPending || !bodyWeight}
                  aria-label="Add bodyweight"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </form>
              <form onSubmit={submitBodyFat} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Field label="Body fat (%)">
                  <input
                    className="input"
                    inputMode="decimal"
                    value={bodyFat}
                    onChange={(event) => setBodyFat(event.target.value)}
                  />
                </Field>
                <button
                  className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-600 px-3 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={logBodyMetricMutation.isPending || !bodyFat}
                  aria-label="Add body fat"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </form>
            </div>
            <form onSubmit={submitMeasurements} className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <input
                  type="date"
                  className="input max-w-44"
                  value={measurementDate || data.today}
                  onChange={(event) => setMeasurementDate(event.target.value)}
                  aria-label="Measurement date"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-600 px-3 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={logBodyMetricMutation.isPending || !hasMeasurementsToSave}
                >
                  <Ruler className="h-4 w-4" />
                  Save measurements
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {bodyMeasurementParts.map((bodyPart) => (
                  <label key={bodyPart} className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {formatBodyPartLabel(bodyPart)}
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        className="input"
                        inputMode="decimal"
                        value={measurementValues[bodyPart] ?? ''}
                        onChange={(event) => updateMeasurementValue(bodyPart, event.target.value)}
                        aria-label={`${formatBodyPartLabel(bodyPart)} measurement`}
                      />
                      <span className="w-8 shrink-0 text-xs text-slate-400">
                        {data.profile.preferredUnits === 'kg' ? 'cm' : 'in'}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </form>
            <MetricList metrics={data.analytics.recentBodyMetrics} />
          </Panel>
        </section>
      </div>

      <section className="grid min-w-0 gap-4 lg:grid-cols-3">
        <Panel title="Volume" icon={<BarChart3 className="h-4 w-4" />}>
          <div className="text-3xl font-semibold text-white">
            {Math.round(data.analytics.totalVolume).toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-slate-300">lb-reps this month</div>
          <div className="mt-3 space-y-2">
            {data.analytics.muscleVolume.slice(0, 5).map((item) => (
              <Meter key={item.muscle} label={item.muscle} value={item.volume} max={data.analytics.muscleVolume[0]?.volume ?? 1} />
            ))}
          </div>
        </Panel>

        <Panel title="Adherence" icon={<Activity className="h-4 w-4" />}>
          <div className="text-3xl font-semibold text-white">{data.analytics.adherence.percent}%</div>
          <div className="mt-1 text-sm text-slate-300">
            {data.analytics.adherence.completed} complete · {data.analytics.adherence.skipped} skipped
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${Math.min(100, data.analytics.adherence.percent)}%` }}
            />
          </div>
        </Panel>

        <Panel title="PRs" icon={<Gauge className="h-4 w-4" />}>
          <div className="space-y-2">
            {data.analytics.prs.slice(0, 6).map((pr) => (
              <div key={pr.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-950/70 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-slate-100">{pr.exerciseName}</span>
                <span className="shrink-0 font-semibold text-emerald-300">
                  {pr.value} {pr.unit}
                </span>
              </div>
            ))}
            {data.analytics.prs.length === 0 && (
              <div className="text-sm text-slate-400">PRs will appear after logged sets.</div>
            )}
          </div>
        </Panel>
      </section>
    </div>
  )
}

function GymCommandPanel({
  activePerformance,
  chatText,
  chatResult,
  pending,
  onTextChange,
  onSubmit,
}: {
  activePerformance: ExercisePerformance | null
  chatText: string
  chatResult: ChatCommandResult | null
  pending: boolean
  onTextChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}) {
  const lastSet = activePerformance?.sets.at(-1) ?? null
  return (
    <div className="mt-4 rounded-lg border border-emerald-500/30 bg-slate-950/70 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-300">
          <MessageSquareText className="h-4 w-4" />
          Gym command
        </div>
        {activePerformance && (
          <div className="truncate text-sm text-slate-300">
            {activePerformance.exerciseName}
          </div>
        )}
      </div>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className="input-lg flex-1"
          value={chatText}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={activePerformance?.suggestedLoad ? `did 10 at ${activePerformance.suggestedLoad}` : 'start Hammer Strength decline press'}
          autoComplete="off"
          enterKeyHint="send"
          aria-label="Workout command"
        />
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-100 px-4 text-base font-semibold text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending || !chatText.trim()}
        >
          <Send className="h-5 w-5" />
          Send
        </button>
      </form>
      {chatResult && (
        <div className={`mt-3 rounded-md border px-3 py-2 text-sm ${chatResult.ok ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-100' : 'border-amber-500/40 bg-amber-950/20 text-amber-100'}`}>
          {chatResult.message}
        </div>
      )}
      {lastSet && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="rounded bg-slate-800 px-2 py-1 text-slate-100">
            Last set
          </span>
          <span>
            {lastSet.setNumber}: {lastSet.load ?? '-'} {lastSet.unit} x {lastSet.reps}{lastSet.rpe ? ` @${lastSet.rpe}` : ''}
          </span>
        </div>
      )}
    </div>
  )
}

function IconButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
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

function MovementRow({
  performance,
  selected,
  unit,
  onSelect,
}: {
  performance: ExercisePerformance
  selected: boolean
  unit: string
  onSelect: () => void
}) {
  const completedSets = performance.sets.filter((set) => set.completed && !set.isWarmup).length
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border px-3 py-3 text-left transition ${
        selected
          ? 'border-emerald-400 bg-emerald-950/30'
          : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-white">{performance.exerciseName}</div>
          <div className="mt-1 text-sm text-slate-300">
            {completedSets}/{performance.prescribedSets} sets · {performance.prescribedRepsMin}-{performance.prescribedRepsMax} reps
            {performance.suggestedLoad ? ` · ${performance.suggestedLoad} ${unit}` : ''}
          </div>
        </div>
        <span className={`w-fit rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
          performance.status === 'completed'
            ? 'bg-emerald-500/20 text-emerald-200'
            : performance.status === 'in_progress'
              ? 'bg-sky-500/20 text-sky-200'
              : 'bg-slate-800 text-slate-300'
        }`}>
          {performance.status.replaceAll('_', ' ')}
        </span>
      </div>
      {performance.sets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {performance.sets.map((set) => (
            <span key={set.id} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200">
              {set.setNumber}: {set.reps}x{set.load ?? '-'}{set.rpe ? ` @${set.rpe}` : ''}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

function MetricList({ metrics }: { metrics: BodyMetricEntry[] }) {
  if (!metrics.length) {
    return <div className="mt-3 text-sm text-slate-400">No body metrics logged yet.</div>
  }
  return (
    <div className="mt-3 space-y-2">
      {metrics.slice(0, 6).map((metric) => (
        <div key={metric.id} className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-slate-950/70 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-slate-200">
            {formatMetricLabel(metric)} · {metric.measuredAt}
          </span>
          <span className="shrink-0 font-semibold text-white">
            {metric.value} {metric.unit}
          </span>
        </div>
      ))}
    </div>
  )
}

function formatMetricLabel(metric: BodyMetricEntry) {
  if (metric.metricType === 'bodyweight') return 'Bodyweight'
  if (metric.metricType === 'bodyfat') return 'Body Fat'
  return formatBodyPartLabel(metric.bodyPart ?? metric.metricType)
}

function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-300">
        <span className="capitalize">{label}</span>
        <span>{Math.round(value).toLocaleString()}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
      </div>
    </div>
  )
}
