import { z } from 'zod'

export type Source = 'ui' | 'chat' | 'telegram' | 'seed' | 'system'

export type WorkoutProfile = {
  id: string
  displayName: string
  timezone: string
  goalType: string
  trainingAge: string
  availableDays: string[]
  sessionLengthMinutes: number
  equipmentProfile: Record<string, unknown>
  injuryNotes: string
  preferredUnits: string
  exerciseAliasesJson: Record<string, unknown>
  accessibilitySettings: {
    largeText: boolean
    highContrast: boolean
    reduceMotion: boolean
  }
}

export type Exercise = {
  id: string
  canonicalName: string
  aliases: string[]
  movementPattern: string
  primaryMuscles: string[]
  equipmentType: string
  defaultRestSeconds: number
  notes: string
  active: boolean
}

export type SetEntry = {
  id: string
  setNumber: number
  reps: number
  load: number | null
  unit: string
  rpe: number | null
  completed: boolean
  isWarmup: boolean
  isFailure: boolean
  notes: string
  source: string
  performedAt: string
}

export type ExercisePerformance = {
  id: string
  exerciseId: string
  exerciseName: string
  movementPattern: string
  primaryMuscles: string[]
  equipmentType: string
  orderIndex: number
  prescribedSets: number
  prescribedRepsMin: number
  prescribedRepsMax: number
  prescribedLoad: number | null
  prescribedIntensityType: string
  prescribedIntensityValue: number | null
  suggestedLoad: number | null
  decision: {
    explanation?: string
    warnings?: string[]
    [key: string]: unknown
  }
  status: string
  notes: string
  sets: SetEntry[]
}

export type WorkoutSession = {
  id: string
  scheduledFor: string
  startedAt: string | null
  completedAt: string | null
  status: string
  routineTemplateId: string | null
  routineDayId: string | null
  routineDayLabel: string | null
  notes: string
  createdBySource: string
  performances: ExercisePerformance[]
}

export type BodyMetricEntry = {
  id: string
  metricType: string
  bodyPart: string | null
  value: number
  unit: string
  measuredAt: string
  source: string
  notes: string
}

export type PrRecord = {
  id: string
  exerciseId: string
  exerciseName: string
  type: string
  value: number
  unit: string
  achievedAt: string
}

export type WorkoutAnalytics = {
  range: 'week' | 'month' | 'quarter'
  totalVolume: number
  muscleVolume: Array<{ muscle: string; volume: number }>
  movementVolume: Array<{ exerciseName: string; volume: number }>
  adherence: {
    completed: number
    planned: number
    skipped: number
    percent: number
  }
  prs: PrRecord[]
  recentBodyMetrics: BodyMetricEntry[]
}

export type WorkoutDashboard = {
  profile: WorkoutProfile
  today: string
  todaySession: WorkoutSession | null
  nextSession: WorkoutSession | null
  activePerformance: ExercisePerformance | null
  analytics: WorkoutAnalytics
  exercises: Exercise[]
}

export const profilePatchSchema = z.object({
  displayName: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  goalType: z.string().min(1).optional(),
  trainingAge: z.string().min(1).optional(),
  availableDays: z.array(z.string()).optional(),
  sessionLengthMinutes: z.number().int().min(10).max(240).optional(),
  equipmentProfile: z.record(z.unknown()).optional(),
  injuryNotes: z.string().optional(),
  preferredUnits: z.enum(['lb', 'kg']).optional(),
  exerciseAliasesJson: z.record(z.unknown()).optional(),
  accessibilitySettings: z.object({
    largeText: z.boolean(),
    highContrast: z.boolean(),
    reduceMotion: z.boolean(),
  }).partial().optional(),
})

export const setEntryInputSchema = z.object({
  reps: z.number().int().min(1).max(200),
  load: z.number().min(0).max(5000).nullable().optional(),
  unit: z.enum(['lb', 'kg']).default('lb'),
  rpe: z.number().min(1).max(10).nullable().optional(),
  setNumber: z.number().int().min(1).optional(),
  isWarmup: z.boolean().default(false),
  isFailure: z.boolean().default(false),
  completed: z.boolean().default(true),
  notes: z.string().default(''),
  source: z.enum(['ui', 'chat', 'telegram', 'system']).default('ui'),
  sourceMessageId: z.string().optional(),
  idempotencyKey: z.string().optional(),
})

export type SetEntryInput = z.infer<typeof setEntryInputSchema>

export const bodyMetricInputSchema = z.object({
  metricType: z.enum(['bodyweight', 'bodyfat', 'measurement']),
  bodyPart: z.string().min(1).nullable().optional(),
  value: z.number().min(0).max(2000),
  unit: z.string().min(1).max(24),
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source: z.enum(['ui', 'chat', 'telegram', 'system']).default('ui'),
  notes: z.string().default(''),
  sourceMessageId: z.string().optional(),
  idempotencyKey: z.string().optional(),
})

export type BodyMetricInput = z.infer<typeof bodyMetricInputSchema>

export const chatCommandInputSchema = z.object({
  text: z.string().min(1),
  source: z.enum(['chat', 'telegram', 'ui']).default('chat'),
  sourceMessageId: z.string().optional(),
})

export type ChatCommandInput = z.infer<typeof chatCommandInputSchema>

export type ChatCommandResult = {
  ok: boolean
  intent: string
  message: string
  data?: unknown
  needsConfirmation?: boolean
}
