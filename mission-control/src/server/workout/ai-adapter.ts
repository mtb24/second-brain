import { parseDeterministicWorkoutCommand, type ParsedWorkoutCommand } from './command-parser'
import { resolveExerciseName, type ExerciseResolution } from './exercise-resolver'
import type { Exercise } from './types'

export type WorkoutAiProvider = 'openai' | 'local' | 'disabled'

export type WorkoutCommandParseInput = {
  text: string
}

export type WorkoutCommandParseResult = {
  provider: WorkoutAiProvider
  command: ParsedWorkoutCommand | null
  source: 'deterministic' | 'ai' | 'unparsed'
  disabledReason?: string
}

export type ExerciseIdentificationInput = {
  query: string
  exercises: Exercise[]
}

export type ExerciseIdentificationResult = ExerciseResolution & {
  provider: WorkoutAiProvider
  source: 'deterministic' | 'ai' | 'unmatched'
}

export type ProgramGenerationInput = {
  goal: string
}

export type ProgramGenerationResult = {
  provider: WorkoutAiProvider
  unavailableReason: string
}

export type WorkoutAiAdapter = {
  provider: WorkoutAiProvider
  parseWorkoutCommand(input: WorkoutCommandParseInput): Promise<WorkoutCommandParseResult>
  identifyExercise(input: ExerciseIdentificationInput): Promise<ExerciseIdentificationResult>
  generateProgram?(input: ProgramGenerationInput): Promise<ProgramGenerationResult>
}

export function getConfiguredWorkoutAiProvider(env: Record<string, string | undefined> = process.env): WorkoutAiProvider {
  const configured = env.WORKOUT_AI_PROVIDER?.toLowerCase()
  if (configured === 'openai' || configured === 'local' || configured === 'disabled') return configured
  if (env.OPENAI_API_KEY && (env.WORKOUT_OPENAI_MODEL || env.OPENAI_MODEL)) return 'openai'
  if (env.WORKOUT_LOCAL_MODEL || env.OLLAMA_HOST || env.OPENCLAW_BASE_URL) return 'local'
  return 'disabled'
}

export function createWorkoutAiAdapter(provider = getConfiguredWorkoutAiProvider()): WorkoutAiAdapter {
  return {
    provider,
    async parseWorkoutCommand(input) {
      const command = parseDeterministicWorkoutCommand(input.text)
      return {
        provider,
        command,
        source: command ? 'deterministic' : 'unparsed',
        disabledReason: command ? undefined : aiUnavailableReason(provider),
      }
    },
    async identifyExercise(input) {
      const resolution = resolveExerciseName(input.query, input.exercises)
      return {
        ...resolution,
        provider,
        source: resolution.status === 'unmatched' ? 'unmatched' : 'deterministic',
      }
    },
    async generateProgram() {
      return {
        provider,
        unavailableReason: aiUnavailableReason(provider),
      }
    },
  }
}

function aiUnavailableReason(provider: WorkoutAiProvider) {
  if (provider === 'disabled') return 'Workout AI is disabled; deterministic parsing remains available.'
  return `${provider} workout AI adapter is configured but not wired in this implementation slice.`
}
