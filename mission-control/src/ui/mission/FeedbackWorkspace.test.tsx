import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { honestFitMissionSummarySchema } from '@/server/honestFitMissionSummary'
import {
  currentProductionSummaryFixture,
  newMainSummaryFixture,
} from '@/test-fixtures/honestFitMissionSummary'
import { FeedbackSummary } from './FeedbackWorkspace'

describe('Mission Feedback workspace', () => {
  it('renders only the bounded read-only feedback projection', () => {
    const summary = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      feedback: {
        ...newMainSummaryFixture.feedback,
        items: [
          {
            ...newMainSummaryFixture.feedback.items[0],
            rawMessage: 'Private message from person@example.com',
            userId: 'user_private',
            userAgent: 'Private browser details',
            stripeCustomerId: 'cus_private',
            careerStory: 'Private career content',
            stack: 'SECRET_STACK',
          },
        ],
      },
    })
    const html = renderToStaticMarkup(<FeedbackSummary summary={summary} />)

    expect(html).toContain('Problem report from the Application Kit workspace')
    expect(html).toContain('FB-0123456789AB')
    expect(html).toContain('/fit/:id')
    expect(html).toContain('Technical context supplied')
    expect(html).not.toMatch(/person@example\.com|user_private|Private browser|cus_private|Private career|SECRET_STACK/)
    expect(html).not.toMatch(/<button|<form|planned|resolved|declined/)
  })

  it('distinguishes an available empty queue from an unavailable production contract', () => {
    const empty = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      feedback: {
        ...newMainSummaryFixture.feedback,
        items: [],
        counts: { scope: 'returned_items', new: 0, reviewed: 0, closed: 0 },
      },
    })
    const unavailable = honestFitMissionSummarySchema.parse(
      currentProductionSummaryFixture,
    )

    expect(renderToStaticMarkup(<FeedbackSummary summary={empty} />)).toContain('No feedback has been submitted yet.')
    expect(renderToStaticMarkup(<FeedbackSummary summary={unavailable} />)).toContain('not yet available from the deployed production contract')
  })

  it('fails closed on a malformed feedback projection without fabricating empty state', () => {
    const malformed = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      feedback: {
        authority: 'wrong_authority',
        items: [],
      },
    })
    const html = renderToStaticMarkup(<FeedbackSummary summary={malformed} />)

    expect(html).toContain('Feedback source is partial')
    expect(html).not.toContain('No feedback has been submitted yet.')
  })

  it('explains bounded results when hasMore is true', () => {
    const summary = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      feedback: {
        ...newMainSummaryFixture.feedback,
        hasMore: true,
      },
    })
    const html = renderToStaticMarkup(<FeedbackSummary summary={summary} />)

    expect(html).toContain('More feedback exists outside this bounded result')
    expect(html).toContain('newest 25 items')
    expect(html).toContain('does not expose a cursor')
  })

  it('shows only the three authoritative status semantics', () => {
    const summary = honestFitMissionSummarySchema.parse(newMainSummaryFixture)
    const html = renderToStaticMarkup(<FeedbackSummary summary={summary} />)

    expect(html).toContain('New, reviewed, and closed')
    expect(html).not.toMatch(/planned|resolved|declined/i)
  })
})
