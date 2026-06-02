export type WorkoutCommandIntent =
  | 'exercise.start'
  | 'set.log'
  | 'sets.record_many'

export type ParsedWorkoutCommand =
  | {
      intent: 'exercise.start'
      exerciseName: string
      confidence: number
      raw: string
    }
  | {
      intent: 'set.log'
      reps: number
      load: number
      unit: 'lb' | 'kg'
      rpe: number | null
      isFailure: boolean
      confidence: number
      raw: string
    }
  | {
      intent: 'sets.record_many'
      sets: number
      reps: number
      load: number
      unit: 'lb' | 'kg'
      rpe: number | null
      confidence: number
      raw: string
    }

const numberPattern = '(\\d+(?:\\.\\d+)?)'
const unitPattern = '(lb|lbs|pounds|kg)?'
const rpePattern = '(?:\\s+(?:@?rpe|rpe)\\s*(\\d+(?:\\.\\d+)?))?'

export function parseDeterministicWorkoutCommand(input: string): ParsedWorkoutCommand | null {
  const raw = input.trim()
  if (!raw) return null

  const startedExercise = raw.match(/^start\s+(?!workout\b|today\b|session\b)(?:this\s+)?(?:(?:exercise|movement)\s*:?\s+)?(.+)$/i)
  if (startedExercise) {
    const exerciseName = cleanExerciseName(startedExercise[1])
    if (!exerciseName) return null
    return {
      intent: 'exercise.start',
      exerciseName,
      confidence: 0.94,
      raw,
    }
  }

  const recordMany = raw.match(new RegExp(`^(\\d+)\\s*x\\s*(\\d+)\\s+(?:at|@)\\s*${numberPattern}\\s*${unitPattern}${rpePattern}\\s*$`, 'i'))
  if (recordMany) {
    const sets = Number(recordMany[1])
    const reps = Number(recordMany[2])
    const load = Number(recordMany[3])
    const rpe = parseOptionalRpe(recordMany[5])
    if (!isPositiveInteger(sets) || !isPositiveInteger(reps) || !isUsableLoad(load)) return null
    return {
      intent: 'sets.record_many',
      sets,
      reps,
      load,
      unit: parseUnit(recordMany[4]),
      rpe,
      confidence: 0.95,
      raw,
    }
  }

  const didSet = raw.match(new RegExp(`^did\\s+(\\d+)(?:\\s+reps?)?\\s+(?:at|@)\\s*${numberPattern}\\s*${unitPattern}${rpePattern}(?:\\s+to\\s+failure)?\\s*$`, 'i'))
  if (didSet) {
    const reps = Number(didSet[1])
    const load = Number(didSet[2])
    const rpe = parseOptionalRpe(didSet[4])
    if (!isPositiveInteger(reps) || !isUsableLoad(load)) return null
    return {
      intent: 'set.log',
      reps,
      load,
      unit: parseUnit(didSet[3]),
      rpe,
      isFailure: /\bfailure\b/i.test(raw),
      confidence: 0.95,
      raw,
    }
  }

  const repsAtLoad = raw.match(new RegExp(`^(\\d+)\\s+reps?\\s+(?:at|@)\\s*${numberPattern}\\s*${unitPattern}${rpePattern}(?:\\s+to\\s+failure)?\\s*$`, 'i'))
  if (repsAtLoad) {
    const reps = Number(repsAtLoad[1])
    const load = Number(repsAtLoad[2])
    const rpe = parseOptionalRpe(repsAtLoad[4])
    if (!isPositiveInteger(reps) || !isUsableLoad(load)) return null
    return {
      intent: 'set.log',
      reps,
      load,
      unit: parseUnit(repsAtLoad[3]),
      rpe,
      isFailure: /\bfailure\b/i.test(raw),
      confidence: 0.93,
      raw,
    }
  }

  return null
}

function cleanExerciseName(value: string) {
  return value.trim().replace(/[.!?]+$/g, '').trim()
}

function parseUnit(unit: string | undefined): 'lb' | 'kg' {
  return unit?.toLowerCase() === 'kg' ? 'kg' : 'lb'
}

function parseOptionalRpe(value: string | undefined) {
  if (!value) return null
  const rpe = Number(value)
  return Number.isFinite(rpe) ? Math.max(1, Math.min(10, rpe)) : null
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0
}

function isUsableLoad(value: number) {
  return Number.isFinite(value) && value >= 0
}
