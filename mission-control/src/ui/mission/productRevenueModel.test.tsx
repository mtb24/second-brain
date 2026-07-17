import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { honestFitMissionSummarySchema } from '@/server/honestFitMissionSummary'
import { newMainSummaryFixture } from '@/test-fixtures/honestFitMissionSummary'
import { ProductSummary } from './ProductWorkspace'
import { RevenueSummary } from './RevenueWorkspace'
import {
  productJourneyNarrative,
  revenueState,
} from './productRevenueModel'

describe('Mission Product evidence semantics', () => {
  it('labels activity as event counts and keeps people evidence unavailable', () => {
    const summary = honestFitMissionSummarySchema.parse(newMainSummaryFixture)
    const html = renderToStaticMarkup(<ProductSummary summary={summary} />)

    expect(html).toContain('Event counts only')
    expect(html).toContain('Unique users')
    expect(html).toContain('Unavailable · not instrumented')
    expect(html).toContain('Retention')
    expect(html).not.toContain('0 users')
  })

  it('distinguishes zero observed events from unavailable instrumentation', () => {
    const summary = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      traffic: {
        ...newMainSummaryFixture.traffic,
        pageViews24h: 0,
      },
      signups: {
        ...newMainSummaryFixture.signups,
        free24h: 0,
      },
      funnel: Object.fromEntries(
        Object.keys(newMainSummaryFixture.funnel).map((key) => [key, 0]),
      ),
      marketing: {
        ...newMainSummaryFixture.marketing,
        ctaClicks24h: {
          getStarted: 0,
          signIn: 0,
          viewPlans: 0,
          partnerApiEmail: 0,
        },
      },
    })

    expect(productJourneyNarrative(summary)).toContain('No journey events were observed')
    const html = renderToStaticMarkup(<ProductSummary summary={summary} />)
    expect(html).toContain('Zero observed events')
    expect(html).toContain('Unavailable · not instrumented')
  })
})

describe('Mission Revenue scope semantics', () => {
  it('keeps lifetime, rolling-24-hour, and current-state groups explicit', () => {
    const summary = honestFitMissionSummarySchema.parse(newMainSummaryFixture)
    const html = renderToStaticMarkup(<RevenueSummary summary={summary} />)

    expect(html).toContain('Lifetime')
    expect(html).toContain('Rolling 24 hours')
    expect(html).toContain('Current state')
    expect(html).toContain('Completed purchases')
    expect(html).toContain('Unavailable')
    expect(html).not.toContain('since active campaign posted')
    expect(html).not.toContain('conversion rate')
  })

  it('distinguishes healthy no-demand from payment and activation failures', () => {
    const zero = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      billing: {
        ...newMainSummaryFixture.billing,
        stripeWebhookEvents24h: 0,
        lastStripeWebhookAt: null,
        campaign: {
          ...newMainSummaryFixture.billing.campaign,
          checkoutSessions24h: 0,
          payments24h: 0,
          paymentFailures24h: 0,
          activations24h: 0,
          activationFailures24h: 0,
          manualReview: 0,
        },
      },
    })
    const paymentFailure = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      billing: {
        ...newMainSummaryFixture.billing,
        campaign: {
          ...newMainSummaryFixture.billing.campaign,
          paymentFailures24h: 1,
        },
      },
    })
    const activationFailure = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      billing: {
        ...newMainSummaryFixture.billing,
        campaign: {
          ...newMainSummaryFixture.billing.campaign,
          activationFailures24h: 1,
        },
      },
    })

    expect(revenueState(zero)).toBe('healthy_no_demand')
    expect(revenueState(paymentFailure)).toBe('payment_failure')
    expect(revenueState(activationFailure)).toBe('activation_failure')
  })

  it('reports stale webhook evidence only when recent campaign activity exists', () => {
    const summary = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      generatedAt: '2026-07-17T13:00:00.000Z',
      billing: {
        ...newMainSummaryFixture.billing,
        lastStripeWebhookAt: '2026-07-16T12:59:59.000Z',
      },
    })
    expect(revenueState(summary)).toBe('stale_webhook')
  })

  it('never renders private Stripe identifiers or payment details', () => {
    const summary = honestFitMissionSummarySchema.parse({
      ...newMainSummaryFixture,
      billing: {
        ...newMainSummaryFixture.billing,
        stripeCustomerId: 'cus_private',
        paymentIntentId: 'pi_private',
        campaign: {
          ...newMainSummaryFixture.billing.campaign,
          priceId: 'price_private',
        },
      },
    })
    const html = renderToStaticMarkup(<RevenueSummary summary={summary} />)
    expect(html).not.toMatch(/cus_private|pi_private|price_private/)
  })
})
