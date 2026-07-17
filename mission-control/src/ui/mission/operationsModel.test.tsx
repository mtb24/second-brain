import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { honestFitMissionSummarySchema } from '@/server/honestFitMissionSummary'
import {
  currentProductionSummaryFixture,
  newMainSummaryFixture,
} from '@/test-fixtures/honestFitMissionSummary'
import { OperationsSummary } from './OperationsWorkspace'
import { incidentGuidance, operationsSubsystemRows } from './operationsModel'

describe('Mission Operations projection', () => {
  it('presents all nine canonical categories without fabricating capacity evidence', () => {
    const summary = honestFitMissionSummarySchema.parse(newMainSummaryFixture)
    const rows = operationsSubsystemRows(summary)

    expect(rows).toHaveLength(9)
    expect(rows.find((row) => row.category === 'capacity')).toMatchObject({
      status: 'unavailable',
      occurrences24h: null,
    })
    expect(rows.find((row) => row.category === 'deployment_release')).toMatchObject({
      status: 'unavailable',
    })
  })

  it('derives controlled impact and action text by incident category', () => {
    expect(incidentGuidance('source_processing')).toEqual({
      impact: 'Source ingestion or processing may be delayed or failing.',
      action: 'Check the source-processing queue and the linked Sentry evidence.',
    })
  })

  it('renders only sanitized incident fields and safe Sentry authority', () => {
    const summary = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      errors: {
        ...newMainSummaryFixture.errors,
        incidents: [
          {
            ...newMainSummaryFixture.errors.incidents[0],
            rawMessage: 'Private exception with person@example.com',
            stack: 'SECRET_STACK_TRACE',
            stripeCustomerId: 'cus_private',
            request: { headers: { cookie: 'secret' } },
          },
        ],
      },
    })
    const html = renderToStaticMarkup(<OperationsSummary summary={summary} />)

    expect(html).toContain('HF-A1B2')
    expect(html).toContain('/api/source/:id')
    expect(html).toContain('Open safe Sentry event')
    expect(html).not.toMatch(/person@example\.com|SECRET_STACK_TRACE|cus_private|cookie|rawMessage/)
  })

  it('distinguishes an unavailable incident contract from no incidents', () => {
    const unavailable = honestFitMissionSummarySchema.parse({
      ...currentProductionSummaryFixture,
      errors: { total24h: 0, critical24h: 0 },
    })
    const noIncidents = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      errors: {
        ...newMainSummaryFixture.errors,
        incidents: [],
      },
    })

    expect(renderToStaticMarkup(<OperationsSummary summary={unavailable} />)).toContain('Incident contract unavailable')
    expect(renderToStaticMarkup(<OperationsSummary summary={noIncidents} />)).toContain('No active operational incidents')
  })
})
