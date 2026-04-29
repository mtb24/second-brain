import {
  addSetToPerformance,
  appendInjuryNote,
  applyDeloadToUpcoming,
  completeSession,
  ensureActiveSession,
  findExerciseByName,
  generateWeekPlan,
  getAnalytics,
  getCurrentPerformance,
  getDashboard,
  getPrs,
  logBodyMetric,
  markPerformanceComplete,
  rescheduleSession,
  setEquipmentProfile,
  startExerciseByName,
  swapExerciseInNextSession,
} from './repository'
import { addDays } from './date'
import type {
  ChatCommandInput,
  ChatCommandResult,
} from './types'

const legMuscles = new Set(['quads', 'glutes', 'hamstrings', 'calves'])

export async function executeWorkoutChatCommand(
  input: ChatCommandInput,
): Promise<ChatCommandResult> {
  const text = input.text.trim()
  const lower = text.toLowerCase()
  const source = input.source
  const sourceMessageId = input.sourceMessageId

  if (/\bwhat'?s next\b|\bnext workout\b|\bnext session\b/.test(lower)) {
    const dashboard = await getDashboard()
    const session = dashboard.todaySession ?? dashboard.nextSession
    const movement = dashboard.activePerformance
    if (!session || !movement) {
      return {
        ok: true,
        intent: 'plan.next',
        message: 'No planned workout is queued yet. Generate the week plan first.',
        data: { session: null },
      }
    }
    return {
      ok: true,
      intent: 'plan.next',
      message: `${session.routineDayLabel ?? 'Workout'} on ${session.scheduledFor}: ${movement.exerciseName}, ${movement.prescribedSets}x${movement.prescribedRepsMin}-${movement.prescribedRepsMax}${movement.suggestedLoad ? ` at ${movement.suggestedLoad} ${dashboard.profile.preferredUnits}` : ''}. ${movement.decision.explanation ?? ''}`.trim(),
      data: { session, movement },
    }
  }

  if (/show my plan for this week|plan for this week/.test(lower)) {
    let dashboard = await getDashboard()
    if (!dashboard.todaySession && !dashboard.nextSession) {
      await generateWeekPlan(source)
      dashboard = await getDashboard()
    }
    const sessions = [dashboard.todaySession, dashboard.nextSession]
      .filter(Boolean)
      .filter((session, index, all) => all.findIndex((item) => item?.id === session?.id) === index)
    const summary = sessions.length
      ? sessions.map((session) => `${session?.scheduledFor}: ${session?.routineDayLabel ?? 'Workout'}`).join('; ')
      : 'No sessions are planned yet.'
    return {
      ok: true,
      intent: 'plan.week',
      message: summary,
      data: { sessions },
    }
  }

  if (/generate|plan/.test(lower) && /week/.test(lower)) {
    const sessions = await generateWeekPlan(source)
    return {
      ok: true,
      intent: 'plan.generate_week',
      message: sessions.length
        ? `Generated ${sessions.length} session${sessions.length === 1 ? '' : 's'} for the next week.`
        : 'The week plan is already current or no available training days are configured.',
      data: { sessions },
    }
  }

  const bodyMetric = parseBodyMetric(text)
  if (bodyMetric) {
    const metric = await logBodyMetric({
      ...bodyMetric,
      source,
      sourceMessageId,
      idempotencyKey: sourceMessageId ? `body:${source}:${sourceMessageId}` : undefined,
    })
    return {
      ok: true,
      intent: 'body_metric.log',
      message: `Logged ${metric.metricType}${metric.bodyPart ? ` for ${metric.bodyPart}` : ''}: ${metric.value} ${metric.unit} on ${metric.measuredAt}.`,
      data: { metric },
    }
  }

  const recordManySets = text.match(/record\s+(\d+)\s*x\s*(\d+)\s+(?:at\s+)?(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds|kg)?\s+(?:on|for)\s+(.+)/i)
  if (recordManySets) {
    const [, setsRaw, repsRaw, loadRaw, exerciseRaw] = recordManySets
    const performance = await startExerciseByName(exerciseRaw, source)
    const sets = Number(setsRaw)
    const reps = Number(repsRaw)
    const load = Number(loadRaw)
    let lastResult = null
    for (let setNumber = 1; setNumber <= sets; setNumber += 1) {
      lastResult = await addSetToPerformance(performance.id, {
        reps,
        load,
        unit: /kg/i.test(text) ? 'kg' : 'lb',
        rpe: null,
        completed: true,
        isWarmup: false,
        isFailure: false,
        notes: '',
        source,
        sourceMessageId,
        idempotencyKey: sourceMessageId ? `set:${source}:${sourceMessageId}:${setNumber}` : undefined,
      })
    }
    return {
      ok: true,
      intent: 'sets.record_many',
      message: `Recorded ${sets}x${reps} at ${load} ${/kg/i.test(text) ? 'kg' : 'lb'} for ${performance.exerciseName}.`,
      data: lastResult,
    }
  }

  const logSet = text.match(/(?:log\s+)?(?:this\s+)?set:?\s*(\d+)\s+reps?\s+(?:at\s+)?(\d+(?:\.\d+)?)\s*(lb|lbs|pounds|kg)?(?:\s+rpe\s*(\d+(?:\.\d+)?))?/i)
  if (logSet) {
    const current = await getCurrentPerformance()
    if (!current) {
      return {
        ok: false,
        intent: 'set.log',
        message: 'No active exercise is ready. Start an exercise first, then log the set.',
      }
    }
    const [, repsRaw, loadRaw, unitRaw, rpeRaw] = logSet
    const result = await addSetToPerformance(current.id, {
      reps: Number(repsRaw),
      load: Number(loadRaw),
      unit: unitRaw?.toLowerCase() === 'kg' ? 'kg' : 'lb',
      rpe: rpeRaw ? Number(rpeRaw) : null,
      completed: true,
      isWarmup: false,
      isFailure: /\bfailure\b/i.test(text),
      notes: '',
      source,
      sourceMessageId,
      idempotencyKey: sourceMessageId ? `set:${source}:${sourceMessageId}` : undefined,
    })
    return {
      ok: true,
      intent: 'set.log',
      message: `Logged ${repsRaw} reps at ${loadRaw} ${unitRaw?.toLowerCase() === 'kg' ? 'kg' : 'lb'} for ${current.exerciseName}.`,
      data: result,
    }
  }

  const startExercise = text.match(/start\s+(?:this\s+)?(?:exercise|movement):?\s+(.+)/i)
  if (startExercise) {
    const performance = await startExerciseByName(startExercise[1], source)
    return {
      ok: true,
      intent: 'exercise.start',
      message: `Started ${performance.exerciseName}. Suggested load: ${performance.suggestedLoad ?? 'choose a conservative start'} ${performance.suggestedLoad ? 'lb' : ''}.`,
      data: { performance },
    }
  }

  const completeExercise = text.match(/mark\s+(.+?)\s+complete/i)
  if (completeExercise) {
    const performance = await markPerformanceComplete(completeExercise[1], source)
    return {
      ok: true,
      intent: 'exercise.complete',
      message: `Marked ${performance?.exerciseName ?? completeExercise[1]} complete.`,
      data: { performance },
    }
  }

  if (/make next week a deload|next week.*deload|deload next week/.test(lower)) {
    const affected = await applyDeloadToUpcoming(source)
    return {
      ok: true,
      intent: 'plan.deload',
      message: affected
        ? `Applied a 10% deload to ${affected} upcoming planned movement${affected === 1 ? '' : 's'}.`
        : 'No upcoming loaded movements were available for a deload yet.',
      data: { affected },
    }
  }

  const swap = text.match(/swap\s+(.+?)\s+for\s+(.+)/i)
  if (swap) {
    const session = await swapExerciseInNextSession(swap[1], swap[2], source)
    return {
      ok: true,
      intent: 'plan.swap_exercise',
      message: `Swapped ${swap[1].trim()} for ${swap[2].trim()} in the next session.`,
      data: { session },
    }
  }

  if (/what weight am i doing|what weight.*this set|weight.*for this set/.test(lower)) {
    const current = await getCurrentPerformance()
    if (!current) {
      return {
        ok: false,
        intent: 'performance.suggested_load',
        message: 'No active movement is selected yet.',
      }
    }
    return {
      ok: true,
      intent: 'performance.suggested_load',
      message: current.suggestedLoad
        ? `${current.exerciseName}: use ${current.suggestedLoad} lb unless the warm-up says otherwise. ${current.decision.explanation ?? ''}`.trim()
        : `${current.exerciseName}: no prior load is available; choose a conservative starting load.`,
      data: { performance: current },
    }
  }

  if (/reschedule.*today.*tomorrow|move.*today.*tomorrow/.test(lower)) {
    const session = await ensureActiveSession(source)
    const nextDate = addDays(session.scheduledFor, 1)
    const updated = await rescheduleSession(session.id, nextDate, source)
    return {
      ok: true,
      intent: 'session.reschedule',
      message: `Rescheduled today's session to ${nextDate}.`,
      data: { session: updated },
    }
  }

  const equipment = text.match(/set my equipment to (.+)/i)
  if (equipment) {
    const value = equipment[1].trim()
    const profile = await setEquipmentProfile({
      mode: value,
      updatedFromChat: true,
    }, source)
    return {
      ok: true,
      intent: 'profile.equipment',
      message: `Updated equipment profile to: ${value}.`,
      data: { profile },
    }
  }

  const note = text.match(/note that (.+)/i)
  if (note && /injur|irritat|pain|tight|sore|tweak/i.test(note[1])) {
    const profile = await appendInjuryNote(note[1], source)
    return {
      ok: true,
      intent: 'profile.injury_note',
      message: 'Saved that note. I will surface it as a constraint check during planning.',
      data: { profile },
    }
  }

  if (/volume/.test(lower) && /(legs|leg|quads|hamstrings|glutes|calves)/.test(lower)) {
    const analytics = await getAnalytics(lower.includes('quarter') ? 'quarter' : 'month')
    const legVolume = analytics.muscleVolume
      .filter((item) => legMuscles.has(item.muscle))
      .reduce((total, item) => total + item.volume, 0)
    return {
      ok: true,
      intent: 'analytics.leg_volume',
      message: `Leg volume for the selected period is ${Math.round(legVolume).toLocaleString()} lb-reps.`,
      data: { legVolume, analytics },
    }
  }

  const prs = text.match(/(?:what are )?my prs? on (.+)|prs? for (.+)/i)
  if (prs) {
    const exerciseName = (prs[1] ?? prs[2]).trim()
    const exercise = await findExerciseByName(exerciseName)
    const records = await getPrs(exercise?.canonicalName ?? exerciseName)
    return {
      ok: true,
      intent: 'analytics.prs',
      message: records.length
        ? records.map((record) => `${record.exerciseName} ${record.type}: ${record.value} ${record.unit}`).join('; ')
        : `No PR records found yet for ${exercise?.canonicalName ?? exerciseName}.`,
      data: { records },
    }
  }

  if (/log today'?s workout|start workout|start today/.test(lower)) {
    const session = await ensureActiveSession(source)
    return {
      ok: true,
      intent: 'session.start',
      message: `Started ${session.routineDayLabel ?? 'today'} for ${session.scheduledFor}.`,
      data: { session },
    }
  }

  if (/complete workout|finish workout/.test(lower)) {
    const session = await ensureActiveSession(source)
    const completed = await completeSession(session.id, source)
    return {
      ok: true,
      intent: 'session.complete',
      message: 'Workout marked complete.',
      data: { session: completed },
    }
  }

  return {
    ok: false,
    intent: 'unknown',
    message: 'I did not recognize that workout command yet. Try "what is next?", "record 5x5 at 185 on squat", or "log this set: 10 reps at 275".',
  }
}

function parseBodyMetric(text: string) {
  const lower = text.toLowerCase()

  const bodyWeight = text.match(/log today'?s weight:?\s*(\d+(?:\.\d+)?)\s*(lb|lbs|pounds|kg)?/i)
  if (bodyWeight) {
    return {
      metricType: 'bodyweight' as const,
      bodyPart: null,
      value: Number(bodyWeight[1]),
      unit: bodyWeight[2]?.toLowerCase() === 'kg' ? 'kg' : 'lb',
      notes: '',
    }
  }

  const bodyFat = text.match(/log today'?s bodyfat\s*%?:?\s*(\d+(?:\.\d+)?)\s*%?/i)
  if (bodyFat) {
    return {
      metricType: 'bodyfat' as const,
      bodyPart: null,
      value: Number(bodyFat[1]),
      unit: '%',
      notes: '',
    }
  }

  const measurement = text.match(/log my ([a-zA-Z ]+) measurement(?: on this date| today|)?:?\s*(\d+(?:\.\d+)?)\s*(inches|inch|in|cm)?/i)
  if (measurement) {
    return {
      metricType: 'measurement' as const,
      bodyPart: measurement[1].trim().toLowerCase(),
      value: Number(measurement[2]),
      unit: lower.includes('cm') ? 'cm' : 'in',
      notes: '',
    }
  }

  return null
}
