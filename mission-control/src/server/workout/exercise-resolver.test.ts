import { describe, expect, it } from 'vitest'
import { resolveExerciseName } from './exercise-resolver'
import type { Exercise } from './types'

const exercises: Exercise[] = [
  exercise('hammer-strength-decline', 'Hammer Strength Decline Press', [
    'hammer decline press',
    'hs decline press',
    'plate-loaded decline press',
  ]),
  exercise('incline-bench-machine', 'Incline Bench Machine', [
    'incline bench',
    'chest press',
  ]),
  exercise('plate-loaded-chest-press', 'Plate-Loaded Chest Press', [
    'plate loaded press',
    'machine chest press',
  ]),
]

describe('resolveExerciseName', () => {
  it('resolves exact canonical names and aliases', () => {
    expect(resolveExerciseName('incline bench', exercises)).toMatchObject({
      status: 'matched',
      matches: [{ exercise: { canonicalName: 'Incline Bench Machine' } }],
    })
  })

  it('normalizes Hammersmith into Hammer Strength matching', () => {
    const result = resolveExerciseName('Hammersmith Decline Press', exercises)

    expect(result.status).toBe('matched')
    expect(result.matches[0]?.exercise.canonicalName).toBe('Hammer Strength Decline Press')
    expect(result.matches[0]?.confidence).toBeGreaterThan(0.9)
  })

  it('surfaces close chest-press matches as ambiguous instead of pretending certainty', () => {
    const result = resolveExerciseName('chest press', exercises)

    expect(result.status).toBe('ambiguous')
    expect(result.matches.map((match) => match.exercise.canonicalName)).toContain('Incline Bench Machine')
    expect(result.matches.map((match) => match.exercise.canonicalName)).toContain('Plate-Loaded Chest Press')
  })
})

function exercise(id: string, canonicalName: string, aliases: string[]): Exercise {
  return {
    id,
    canonicalName,
    aliases,
    movementPattern: 'horizontal_push',
    primaryMuscles: ['chest'],
    equipmentType: 'machine',
    defaultRestSeconds: 120,
    notes: '',
    active: true,
  }
}
