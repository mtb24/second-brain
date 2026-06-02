import { describe, expect, it } from 'vitest'
import { parseDeterministicWorkoutCommand } from './command-parser'

describe('parseDeterministicWorkoutCommand', () => {
  it('parses the mobile start exercise shorthand without catching session starts', () => {
    expect(parseDeterministicWorkoutCommand('start Hammer Strength decline press')).toMatchObject({
      intent: 'exercise.start',
      exerciseName: 'Hammer Strength decline press',
    })

    expect(parseDeterministicWorkoutCommand('start workout')).toBeNull()
    expect(parseDeterministicWorkoutCommand('start today')).toBeNull()
  })

  it('parses did-set shorthand', () => {
    expect(parseDeterministicWorkoutCommand('did 12 reps at 160')).toMatchObject({
      intent: 'set.log',
      reps: 12,
      load: 160,
      unit: 'lb',
      rpe: null,
    })

    expect(parseDeterministicWorkoutCommand('did 8 at 72.5 kg rpe 8.5')).toMatchObject({
      intent: 'set.log',
      reps: 8,
      load: 72.5,
      unit: 'kg',
      rpe: 8.5,
    })
  })

  it('parses reps-at-load shorthand', () => {
    expect(parseDeterministicWorkoutCommand('10 reps at 185 to failure')).toMatchObject({
      intent: 'set.log',
      reps: 10,
      load: 185,
      isFailure: true,
    })
  })

  it('parses many-set shorthand against the current exercise', () => {
    expect(parseDeterministicWorkoutCommand('3x8 at 120')).toMatchObject({
      intent: 'sets.record_many',
      sets: 3,
      reps: 8,
      load: 120,
      unit: 'lb',
    })
  })
})
