import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  addSetToPerformance: vi.fn(),
  appendInjuryNote: vi.fn(),
  applyDeloadToUpcoming: vi.fn(),
  completeSession: vi.fn(),
  ensureActiveSession: vi.fn(),
  findExerciseByName: vi.fn(),
  generateWeekPlan: vi.fn(),
  getAnalytics: vi.fn(),
  getCurrentPerformance: vi.fn(),
  getDashboard: vi.fn(),
  getPrs: vi.fn(),
  logBodyMetric: vi.fn(),
  markPerformanceComplete: vi.fn(),
  rescheduleSession: vi.fn(),
  resolveExerciseByName: vi.fn(),
  setEquipmentProfile: vi.fn(),
  startExerciseByName: vi.fn(),
  swapExerciseInNextSession: vi.fn(),
}))

vi.mock('./repository', () => mocks)

const { executeWorkoutChatCommand } = await import('./chat')

describe('executeWorkoutChatCommand deterministic gym commands', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
  })

  it('starts a fuzzy-resolved exercise through the existing backend', async () => {
    mocks.resolveExerciseByName.mockResolvedValue({
      status: 'matched',
      matches: [{
        confidence: 0.98,
        exercise: {
          id: 'exercise-1',
          canonicalName: 'Hammer Strength Decline Press',
        },
      }],
    })
    mocks.startExerciseByName.mockResolvedValue({
      id: 'performance-1',
      exerciseId: 'exercise-1',
      exerciseName: 'Hammer Strength Decline Press',
      suggestedLoad: 160,
    })

    const result = await executeWorkoutChatCommand({
      text: 'start Hammersmith Decline Press',
      source: 'ui',
    })

    expect(mocks.startExerciseByName).toHaveBeenCalledWith('Hammer Strength Decline Press', 'ui')
    expect(result).toMatchObject({
      ok: true,
      intent: 'exercise.start',
      message: 'Started Hammer Strength Decline Press. Suggested start: 160 lb.',
      entities: {
        exerciseId: 'exercise-1',
        exerciseName: 'Hammer Strength Decline Press',
      },
    })
  })

  it('asks one clarification when the exercise resolver is ambiguous', async () => {
    mocks.resolveExerciseByName.mockResolvedValue({
      status: 'ambiguous',
      matches: [
        { confidence: 0.86, exercise: { id: 'a', canonicalName: 'Incline Bench Machine' } },
        { confidence: 0.84, exercise: { id: 'b', canonicalName: 'Plate-Loaded Chest Press' } },
      ],
    })

    const result = await executeWorkoutChatCommand({
      text: 'start chest press',
      source: 'chat',
    })

    expect(mocks.startExerciseByName).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      ok: false,
      intent: 'exercise.start',
      needsConfirmation: true,
      clarificationOptions: [
        { id: 'a', label: 'Incline Bench Machine' },
        { id: 'b', label: 'Plate-Loaded Chest Press' },
      ],
    })
  })

  it('logs did-set shorthand against the current performance with idempotency', async () => {
    mocks.getCurrentPerformance.mockResolvedValue({
      id: 'performance-1',
      exerciseName: 'Hammer Strength Decline Press',
    })
    mocks.addSetToPerformance.mockResolvedValue({
      set: { id: 'set-1', setNumber: 1 },
      session: { id: 'session-1' },
    })

    const result = await executeWorkoutChatCommand({
      text: 'did 12 reps at 160',
      source: 'telegram',
      sourceMessageId: 'tg-1',
    })

    expect(mocks.addSetToPerformance).toHaveBeenCalledWith('performance-1', expect.objectContaining({
      reps: 12,
      load: 160,
      unit: 'lb',
      source: 'telegram',
      sourceMessageId: 'tg-1',
      idempotencyKey: 'set:telegram:tg-1',
    }))
    expect(result).toMatchObject({
      ok: true,
      intent: 'set.log',
      message: 'Set 1: 160 lb x 12 for Hammer Strength Decline Press.',
    })
  })

  it('records many shorthand sets against the current performance', async () => {
    mocks.getCurrentPerformance.mockResolvedValue({
      id: 'performance-1',
      exerciseName: 'Lat Pulldown',
    })
    mocks.addSetToPerformance.mockResolvedValue({
      set: { id: 'set-last', setNumber: 3 },
      session: { id: 'session-1' },
    })

    const result = await executeWorkoutChatCommand({
      text: '3x8 at 120',
      source: 'chat',
      sourceMessageId: 'msg-2',
    })

    expect(mocks.addSetToPerformance).toHaveBeenCalledTimes(3)
    expect(mocks.addSetToPerformance).toHaveBeenNthCalledWith(1, 'performance-1', expect.objectContaining({
      reps: 8,
      load: 120,
      idempotencyKey: 'set:chat:msg-2:1',
    }))
    expect(mocks.addSetToPerformance).toHaveBeenNthCalledWith(3, 'performance-1', expect.objectContaining({
      idempotencyKey: 'set:chat:msg-2:3',
    }))
    expect(result).toMatchObject({
      ok: true,
      intent: 'sets.record_many',
      message: 'Recorded 3x8 at 120 lb for Lat Pulldown.',
    })
  })
})
