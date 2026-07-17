import { createHmac } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { honestFitMissionSummarySchema } from '../../src/server/honestFitMissionSummary'
import {
  currentProductionSummaryFixture,
  newMainSummaryFixture,
} from '../../src/test-fixtures/honestFitMissionSummary'
import type {
  HonestFitMarketingCampaign,
  HonestFitMarketingCampaignState,
} from '../../src/lib/honestFitMarketingExperiment'

const currentProductionSummary = honestFitMissionSummarySchema.parse(
  currentProductionSummaryFixture,
)
const newMainSummary = honestFitMissionSummarySchema.parse(newMainSummaryFixture)
const partialFeedbackSummary = honestFitMissionSummarySchema.parse({
  ...newMainSummaryFixture,
  feedback: { authority: 'unexpected', items: [] },
})
const controlledTrafficSummary = honestFitMissionSummarySchema.parse({
  ...newMainSummaryFixture,
  traffic: {
    ...newMainSummaryFixture.traffic,
    classification: {
      raw: 12,
      estimatedReal: 4,
      testingSmokeAdmin: 5,
      ambiguous: 3,
    },
  },
})

const activeCampaign = campaignFixture()
const preparedCampaign = campaignFixture({
  id: 'campaign-prepared',
  title: 'Recruiter-value Trust Layer post',
  status: 'ready',
  angle: 'Recruiter-value',
})
const campaignState: HonestFitMarketingCampaignState = {
  campaigns: [activeCampaign, preparedCampaign],
  selectedCampaignId: activeCampaign.id,
}

const workspaces = [
  { path: '/', slug: 'today', heading: 'What needs my attention now?', ready: 'Current production state' },
  { path: '/product', slug: 'product', heading: 'Are users reaching value?', ready: 'Journey interpretation' },
  { path: '/revenue', slug: 'revenue', heading: 'Is the Job Search Campaign selling and activating correctly?', ready: 'Campaign state' },
  { path: '/operations', slug: 'operations', heading: 'Is HonestFit functioning reliably?', ready: 'Reliability overview' },
  { path: '/feedback', slug: 'feedback', heading: 'What are users telling us?', ready: 'Read-only queue' },
  { path: '/campaigns', slug: 'marketing', heading: 'What should I publish or adjust next?', ready: 'Marketing decision' },
] as const

test.beforeEach(async ({ context, baseURL, page }) => {
  await authenticate(context, baseURL)
  await fulfillSummary(page, newMainSummary)
  await fulfillCampaignState(page, campaignState)
})

test('renders all six workspaces without overflow or undersized controls', async ({ page }, testInfo) => {
  for (const workspace of workspaces) {
    await page.goto(workspace.path)
    await expect(page.getByRole('heading', { level: 1, name: workspace.heading })).toBeVisible()
    await expect(page.getByText(workspace.ready, { exact: true })).toBeVisible()
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('main')).not.toContainText(/rawMessage|SECRET_STACK|cus_private|person@example\.com/)
    if (workspace.slug === 'marketing') {
      await expect(page.getByText('HonestFit evidence · Read only')).toBeVisible()
    }

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      domNodes: document.querySelectorAll('*').length,
      navigationMs: Math.round(
        (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.duration ?? 0,
      ),
      resourceCount: performance.getEntriesByType('resource').length,
      overflowElements: Array.from(document.querySelectorAll('body *'))
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === 'string' ? element.className : '',
          text: element.textContent?.trim().slice(0, 80) ?? '',
          left: Math.round(element.getBoundingClientRect().left),
          right: Math.round(element.getBoundingClientRect().right),
        }))
        .filter((element) => element.left < -1 || element.right > window.innerWidth + 1)
        .slice(0, 12),
    }))
    expect(layout.overflowElements).toEqual([])
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1)
    expect(layout.domNodes).toBeLessThan(2_500)

    const targetHeights = await page
      .locator('header a:visible, header button:visible, nav a:visible, main a:visible, main button:visible, main summary:visible')
      .evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().height * 10) / 10))
    expect(targetHeights.length).toBeGreaterThan(0)
    expect(Math.min(...targetHeights)).toBeGreaterThanOrEqual(43.5)

    if (workspace.slug === 'today') {
      expect(layout.scrollHeight / layout.viewportHeight).toBeLessThanOrEqual(
        testInfo.project.name === 'chromium-mobile' ? 2.25 : 2.25,
      )
    }

    await saveLayoutEvidence(testInfo.project.name, workspace.slug, layout)
    await saveEvidenceScreenshot(page, testInfo.project.name, workspace.slug)
  }
})

test('protects campaign edits from accidental selection changes', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    })
  })
  await page.goto('/campaigns')
  await page.getByRole('button', { name: 'Copy post body' }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  const postBody = page.getByRole('textbox', { name: 'Post body' })
  await postBody.fill('Updated campaign copy')
  await expect(page.getByRole('button', { name: 'Copy post body' })).toBeVisible()

  const hook = page.getByRole('textbox', { name: 'Hook', exact: true })
  await hook.fill('A locally edited campaign hook')
  await expect(page.getByText('Unsaved campaign changes')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save or discard edits' })).toBeDisabled()

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm')
    expect(dialog.message()).toContain('Unsaved campaign changes will be lost')
    await dialog.dismiss()
  })
  await page.getByRole('link', { name: 'Product', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'What should I publish or adjust next?' })).toBeVisible()

  const postedUrl = page.getByRole('textbox', { name: 'Posted URL' })
  await postedUrl.fill('https://www.linkedin.com/posts/example')
  await expect(page.getByRole('button', { name: 'Mark as posted' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save campaign' })).toBeDisabled()
  await expect(page.getByText('Campaign copy and a live URL are both unsaved.')).toBeVisible()
  await postedUrl.fill('')
  await expect(page.getByRole('button', { name: 'Save campaign' })).toBeEnabled()

  const compactPipeline = page.locator('summary').filter({ hasText: 'Campaign pipeline' })
  if (await compactPipeline.isVisible()) await compactPipeline.click()
  const prepared = page.getByRole('button', {
    name: 'Recruiter-value Trust Layer post, Prepared',
  })
  await expect(prepared).toBeDisabled()

  await page.getByRole('button', { name: 'Discard local changes' }).click()
  await expect(page.getByText('Unsaved campaign changes')).toHaveCount(0)
  await expect(prepared).toBeEnabled()
  await prepared.click()
  await expect(page.getByRole('heading', { level: 2, name: 'Recruiter-value Trust Layer post', exact: true })).toBeVisible()
})

test('keeps campaign controls usable when telemetry fails', async ({ page }) => {
  await page.unroute('**/api/honestfit/mission-summary')
  await page.route('**/api/honestfit/mission-summary', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'error', message: 'fixture failure' }),
    })
  })

  await page.goto('/campaigns')
  await expect(page.getByText('Marketing evidence unavailable')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy post body' })).toBeVisible()
  await expect(page.getByText('Zero observed events')).toHaveCount(0)
})

test('supports keyboard navigation, visible focus, and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'Skip to main content' })
  await expect(skipLink).toBeFocused()
  await expect(skipLink).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('#mission-main')).toBeFocused()

  const reducedMotion = await page.evaluate(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  expect(reducedMotion).toBe(true)
})

test('distinguishes deployed legacy, malformed feedback, and controlled traffic states', async ({ page }) => {
  await fulfillSummary(page, currentProductionSummary)
  await page.goto('/feedback')
  await expect(page.getByText('Feedback reporting is not yet available')).toBeVisible()
  await expect(page.getByText('No feedback has been submitted yet.')).toHaveCount(0)

  await fulfillSummary(page, partialFeedbackSummary)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'What needs my attention now?' })).toBeVisible()
  await page.goto('/feedback')
  await expect(page.getByText('Feedback source is partial')).toBeVisible()

  await fulfillSummary(page, controlledTrafficSummary)
  await page.goto('/')
  const systems = page.locator('summary').filter({ hasText: /healthy · \d+ degraded/ })
  await systems.focus()
  await systems.press('Enter')
  await expect(page.getByText('5 traffic events are classified as controlled testing, smoke, or admin activity.')).toBeVisible()
  await expect(page.getByText('Incident origin is not inferred when HonestFit does not declare it.')).toBeVisible()
})

test('matches reviewed workspace screenshots', async ({ page }) => {
  test.skip(
    process.env.MISSION_VISUAL_REGRESSION !== '1',
    'Visual baselines run explicitly after fixture and layout review.',
  )

  for (const workspace of workspaces) {
    await page.goto(workspace.path)
    await expect(page.getByText(workspace.ready, { exact: true })).toBeVisible()
    await expect(page).toHaveScreenshot(`${workspace.slug}.png`, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    })
  }
})

async function fulfillSummary(
  page: Page,
  summary: ReturnType<typeof honestFitMissionSummarySchema.parse>,
) {
  await page.unroute('**/api/honestfit/mission-summary').catch(() => undefined)
  await page.route('**/api/honestfit/mission-summary', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', summary }),
    })
  })
}

async function fulfillCampaignState(
  page: Page,
  initialState: HonestFitMarketingCampaignState,
) {
  let state = structuredClone(initialState)
  await page.unroute('**/api/honestfit/marketing-experiment').catch(() => undefined)
  await page.route('**/api/honestfit/marketing-experiment', async (route) => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as {
        action?: string
        campaignId?: string
        campaign?: Partial<HonestFitMarketingCampaign>
      }
      if (body.action === 'update' && body.campaignId && body.campaign) {
        state = {
          ...state,
          campaigns: state.campaigns.map((campaign) =>
            campaign.id === body.campaignId
              ? { ...campaign, ...body.campaign, updatedAt: '2026-07-17T14:00:00.000Z' }
              : campaign,
          ),
          selectedCampaignId: body.campaignId,
        }
      }
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(state),
    })
  })
}

function campaignFixture(
  patch: Partial<HonestFitMarketingCampaign> = {},
): HonestFitMarketingCampaign {
  return {
    id: 'campaign-active',
    title: 'Problem-first Trust Layer post',
    status: 'draft',
    channel: 'linkedin',
    targetUrl: 'https://honestfit.ai/c/ken-downey',
    postBody: 'A resume is a list of claims. HonestFit helps candidates show what supports them.',
    postDraft: 'A resume is a list of claims. HonestFit helps candidates show what supports them.',
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

async function authenticate(context: BrowserContext, baseURL?: string) {
  const username = process.env.MC_USERNAME ?? 'playwright-smoke'
  const secret =
    process.env.MC_SESSION_SECRET ??
    'local-playwright-session-secret-32-chars'
  const exp = Math.floor(Date.now() / 1000) + 60 * 60
  const payloadB64 = Buffer.from(
    JSON.stringify({ u: username, exp }),
    'utf8',
  ).toString('base64url')
  const sig = createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url')
  await context.addCookies([
    {
      name: 'mc_session',
      value: `${payloadB64}.${sig}`,
      url: baseURL ?? 'http://127.0.0.1:4173',
      httpOnly: true,
      sameSite: 'Strict',
      secure: false,
    },
  ])
}

async function saveEvidenceScreenshot(
  page: Page,
  projectName: string,
  slug: string,
) {
  const directory = process.env.MISSION_SCREENSHOT_DIR
  if (!directory) return
  await fs.mkdir(directory, { recursive: true })
  await page.screenshot({
    path: path.join(directory, `${projectName}-${slug}.png`),
    fullPage: true,
    animations: 'disabled',
  })
}

async function saveLayoutEvidence(
  projectName: string,
  slug: string,
  evidence: unknown,
) {
  const directory = process.env.MISSION_SCREENSHOT_DIR
  if (!directory) return
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(
    path.join(directory, `${projectName}-${slug}.json`),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  )
}
