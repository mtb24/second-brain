import { describe, expect, it } from 'vitest'
import { honestFitMissionSummarySchema } from '@/server/honestFitMissionSummary'
import {
  currentProductionSummaryFixture,
  newMainSummaryFixture,
} from '@/test-fixtures/honestFitMissionSummary'
import {
  missionOperationalState,
  isMissionSummaryStale,
  openIncidents,
  todayAttentionItems,
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

  it('prioritizes at most three operator actions without inventing feedback', () => {
    const summary = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      health: {
        ...newMainSummaryFixture.health,
        status: 'degraded',
      },
      errors: {
        ...newMainSummaryFixture.errors,
        incidents: [
          {
            ...newMainSummaryFixture.errors.incidents[0],
            severity: 'critical',
            status: 'open',
          },
        ],
        subsystems: {
          ...newMainSummaryFixture.errors.subsystems,
          source_processing: { status: 'degraded', occurrences24h: 4 },
        },
      },
      billing: {
        ...newMainSummaryFixture.billing,
        campaign: {
          ...newMainSummaryFixture.billing.campaign,
          paymentFailures24h: 2,
          activationFailures24h: 1,
        },
      },
      previous: {
        traffic: { pageViews24h: 40 },
      },
    })

    const actions = todayAttentionItems(summary)
    expect(actions).toHaveLength(3)
    expect(actions.map((action) => action.id)).toEqual([
      'critical-incidents',
      'campaign-failures',
      'unread-feedback',
    ])
  })

  it('surfaces unavailable incident detail without treating feedback as zero', () => {
    const summary = honestFitMissionSummarySchema.parse({
      ...currentProductionSummaryFixture,
      errors: {
        total24h: 2,
        critical24h: 0,
      },
    })

    expect(todayAttentionItems(summary)[0]).toMatchObject({
      id: 'incident-contract',
      href: '/operations',
    })
    expect(unreadFeedbackCount(summary)).toBeNull()
  })

  it('reports a comparable traffic drop as event evidence only', () => {
    const summary = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      errors: {
        ...newMainSummaryFixture.errors,
        incidents: [],
      },
      feedback: {
        ...newMainSummaryFixture.feedback,
        items: [],
        counts: { scope: 'returned_items', new: 0, reviewed: 0, closed: 0 },
      },
      previous: {
        traffic: { pageViews24h: 30 },
      },
      traffic: {
        ...newMainSummaryFixture.traffic,
        pageViews24h: 10,
      },
    })

    expect(todayAttentionItems(summary)).toContainEqual(
      expect.objectContaining({ id: 'traffic-drop', href: '/product' }),
    )
  })

  it('treats stale protected source data as a watch condition', () => {
    const summary = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      errors: {
        ...newMainSummaryFixture.errors,
        incidents: [],
      },
    })
    const now = Date.parse('2026-07-17T13:06:00.000Z')

    expect(isMissionSummaryStale(summary, now)).toBe(true)
    expect(missionOperationalState(summary, now)).toBe('watch')
  })
})
