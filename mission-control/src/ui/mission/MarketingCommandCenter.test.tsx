import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { honestFitMissionSummarySchema } from '@/server/honestFitMissionSummary'
import { newMainSummaryFixture } from '@/test-fixtures/honestFitMissionSummary'
import type {
  HonestFitMarketingCampaign,
  HonestFitMarketingCampaignState,
} from '@/lib/honestFitMarketingExperiment'
import { MarketingCommandCenterView } from './MarketingCommandCenter'

const summary = honestFitMissionSummarySchema.parse(newMainSummaryFixture)

function campaign(
  patch: Partial<HonestFitMarketingCampaign> = {},
): HonestFitMarketingCampaign {
  return {
    id: 'campaign-draft',
    title: 'Problem-first Trust Layer post',
    status: 'draft',
    channel: 'linkedin',
    targetUrl: 'https://honestfit.ai/c/ken-downey',
    postBody: 'A resume is a list of claims.',
    postDraft: 'A resume is a list of claims.',
    hook: 'A resume is a list of claims.',
    angle: 'Problem-first',
    audience: 'Recruiters and senior candidates',
    hypothesis: 'A direct hook will earn qualified profile visits.',
    suggestedScreenshot: 'Public profile first fold',
    feedbackAsk: 'What evidence would you want?',
    postedUrl: null,
    postUrl: null,
    postedAt: null,
    checkAfter: null,
    checkAfterHours: 24,
    learningWhatHappened: '',
    learningWhatWasConfusing: '',
    nextMessageAngle: '',
    createdAt: '2026-07-17T10:00:00.000Z',
    updatedAt: '2026-07-17T11:00:00.000Z',
    ...patch,
  }
}

function state(
  selected = campaign(),
  others: HonestFitMarketingCampaign[] = [],
): HonestFitMarketingCampaignState {
  return {
    campaigns: [selected, ...others],
    selectedCampaignId: selected.id,
  }
}

describe('MarketingCommandCenterView', () => {
  it('renders a decision-first organic marketing command center', () => {
    const html = renderToStaticMarkup(
      <MarketingCommandCenterView
        summaryResult={{ status: 'success', summary }}
        campaignState={state(
          campaign(),
          [campaign({ id: 'prepared', title: 'Recruiter-value post', status: 'ready' })],
        )}
      />,
    )

    expect(html).toContain('What should I publish or adjust next?')
    expect(html).toContain('Marketing decision')
    expect(html).toContain('Finish and publish')
    expect(html).toContain('Market response evidence')
    expect(html).toContain('Aggregate events · not people')
    expect(html).toContain('Custom “since posted” attribution is unsupported')
    expect(html).toContain('Organic and owned campaign control')
    expect(html).toContain('Paid-media spend, budget, impressions, reach, and cost evidence are not connected')
    expect(html).toContain('Campaign pipeline')
    expect(html).toContain('Copy post body')
    expect(html).toContain('Save campaign')
    expect(html).toContain('Mark as posted')
    expect(html).not.toContain('conversion rate')
  })

  it('keeps campaign controls available when protected telemetry fails', () => {
    const html = renderToStaticMarkup(
      <MarketingCommandCenterView
        summaryResult={{ status: 'error', message: 'upstream failed' }}
        campaignState={state()}
      />,
    )

    expect(html).toContain('Marketing evidence unavailable')
    expect(html).toContain('Campaign controls remain available')
    expect(html).toContain('Copy post body')
    expect(html).not.toContain('Campaign controls unavailable')
    expect(html).not.toContain('Zero observed events')
  })

  it('does not fabricate a campaign when authenticated storage is empty', () => {
    const html = renderToStaticMarkup(
      <MarketingCommandCenterView
        summaryResult={{ status: 'success', summary }}
        campaignState={{ campaigns: [], selectedCampaignId: 'missing' }}
      />,
    )

    expect(html).toContain('No campaigns are configured')
    expect(html).not.toContain('Mark as posted')
  })

  it('shows the learning workflow only for a live campaign', () => {
    const live = campaign({
      id: 'live',
      status: 'waiting_for_data',
      postedUrl: 'https://www.linkedin.com/posts/example',
      postUrl: 'https://www.linkedin.com/posts/example',
      postedAt: '2026-07-17T12:00:00.000Z',
      checkAfter: '2026-07-18T12:00:00.000Z',
    })
    const html = renderToStaticMarkup(
      <MarketingCommandCenterView
        summaryResult={{ status: 'success', summary }}
        campaignState={state(live)}
      />,
    )

    expect(html).toContain('Measure the live post, then capture what you learned')
    expect(html).toContain('Capture qualitative learning')
    expect(html).toContain('What happened')
    expect(html).toContain('What was confusing')
    expect(html).toContain('Next message angle')
    expect(html).toContain('Save campaign learning')
    expect(html).not.toContain('Mark as posted')
  })

  it('turns captured learning into a bounded next-campaign decision', () => {
    const learned = campaign({
      id: 'learned',
      status: 'learning_captured',
      learningWhatHappened: 'Recruiters asked about evidence boundaries.',
      learningWhatWasConfusing: 'The product category was unclear.',
      nextMessageAngle: 'Lead with recruiter inspection time.',
    })
    const html = renderToStaticMarkup(
      <MarketingCommandCenterView
        summaryResult={{ status: 'success', summary }}
        campaignState={state(learned, [campaign({ id: 'prepared', status: 'ready' })])}
      />,
    )

    expect(html).toContain('Turn the learning into the next message test')
    expect(html).toContain('What this campaign taught us')
    expect(html).toContain('Lead with recruiter inspection time.')
    expect(html).toContain('Choose the next prepared angle')
    expect(html).not.toContain('Save campaign learning')
  })
})
