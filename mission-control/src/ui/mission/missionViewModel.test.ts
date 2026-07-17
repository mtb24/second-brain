import { describe, expect, it } from 'vitest'
import { honestFitMissionSummarySchema } from '@/server/honestFitMissionSummary'
import {
  currentProductionSummaryFixture,
  newMainSummaryFixture,
} from '@/test-fixtures/honestFitMissionSummary'
import {
  missionOperationalState,
  openIncidents,
  unreadFeedbackCount,
} from './missionViewModel'

describe('Mission HonestFit view model', () => {
  it('uses one canonical state across health, incidents, and subsystems', () => {
    const summary = honestFitMissionSummarySchema.parse({
      ...currentProductionSummaryFixture,
      health: {
        ...currentProductionSummaryFixture.health,
        status: 'ok',
        warningCount: 0,
      },
      errors: {
        ...currentProductionSummaryFixture.errors,
        incidents: [
          {
            ...currentProductionSummaryFixture.errors.incidents[0],
            severity: 'critical',
            status: 'open',
          },
        ],
      },
    })

    expect(missionOperationalState(summary)).toBe('attention')
    expect(openIncidents(summary)).toHaveLength(1)
  })

  it('distinguishes an unavailable feedback contract from zero feedback', () => {
    const production = honestFitMissionSummarySchema.parse(
      currentProductionSummaryFixture,
    )
    const newMain = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      feedback: {
        ...newMainSummaryFixture.feedback,
        items: [],
        counts: { scope: 'returned_items', new: 0, reviewed: 0, closed: 0 },
      },
    })

    expect(unreadFeedbackCount(production)).toBeNull()
    expect(unreadFeedbackCount(newMain)).toBe(0)
  })

  it('keeps resolved incidents out of the active exception count', () => {
    const summary = honestFitMissionSummarySchema.parse({
      ...currentProductionSummaryFixture,
      errors: {
        ...currentProductionSummaryFixture.errors,
        incidents: currentProductionSummaryFixture.errors.incidents.map((incident) => ({
          ...incident,
          status: 'resolved',
        })),
      },
    })
    expect(openIncidents(summary)).toEqual([])
  })
})
