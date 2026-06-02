import { createHmac } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { bodyMeasurementParts, formatBodyPartLabel } from '../../src/workout/body-measurements'

const specDir = path.dirname(fileURLToPath(import.meta.url))
loadEnv(path.resolve(specDir, '..', '..', '..', '.env'))
loadEnv(path.resolve(specDir, '..', '..', '.env'))
process.env.MC_USERNAME ??= 'playwright-smoke'
process.env.MC_SESSION_SECRET ??= 'local-playwright-session-secret-32-chars'

test.describe('workout route auth boundary', () => {
  test('redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/workout')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible()
    await expect(page.getByLabel('Username')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('accepts the local dev login fallback without a server error', async ({ page }) => {
    test.skip(Boolean(process.env.MC_PASSWORD_HASH), 'Local fallback applies only when MC_PASSWORD_HASH is unset')

    await page.goto('/login')
    await page.getByLabel('Username').fill(requireEnv('MC_USERNAME'))
    await page.getByLabel('Password').fill('local-dev')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
  })
})

test.describe('workout gym command flow', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: 'mc_session',
        value: issueMcSessionValue(),
        url: baseURL ?? 'http://127.0.0.1:4173',
        httpOnly: true,
        sameSite: 'Strict',
        secure: false,
      },
    ])
  })

  test('renders command-first gym capture on desktop and mobile', async ({ page }) => {
    await page.goto('/workout')

    await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible()
    await expect(page.getByText('Gym command')).toBeVisible()

    const commandInput = page.getByLabel('Workout command')
    await expect(commandInput).toBeVisible()

    const sendButton = page.getByRole('button', { name: 'Send' })
    await expect(sendButton).toBeVisible()
    await expect(sendButton).toBeDisabled()

    await commandInput.fill('start Hammer Strength decline press')
    await expect(sendButton).toBeEnabled()

    await expect(page.getByText('Body Metrics')).toBeVisible()
    await expect(page.getByRole('link', { name: 'View trends' })).toBeVisible()
    await expect(page.getByLabel('Body fat (%)')).toBeVisible()
    await expect(page.getByLabel('Measurement date')).toBeVisible()

    for (const bodyPart of bodyMeasurementParts) {
      await expect(page.getByLabel(`${formatBodyPartLabel(bodyPart)} measurement`)).toBeVisible()
    }

    const saveMeasurements = page.getByRole('button', { name: 'Save measurements' })
    await expect(saveMeasurements).toBeDisabled()

    const firstMeasurement = page.getByLabel(`${formatBodyPartLabel(bodyMeasurementParts[0])} measurement`)
    await firstMeasurement.fill('42')
    await expect(saveMeasurements).toBeEnabled()

    await firstMeasurement.focus()
    for (const bodyPart of bodyMeasurementParts.slice(1)) {
      await page.keyboard.press('Tab')
      await expect(page.getByLabel(`${formatBodyPartLabel(bodyPart)} measurement`)).toBeFocused()
    }

    await expect(page.getByText('Volume')).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(hasHorizontalOverflow).toBe(false)

    await page.getByRole('link', { name: 'View trends' }).click()
    await expect(page).toHaveURL(/\/workout\/metrics/)
    await expect(page.getByRole('heading', { name: 'Body Metrics' })).toBeVisible()
    await expect(page.getByText('Body Composition')).toBeVisible()
    await expect(page.getByText('Body Fat').first()).toBeVisible()
    await expect(page.getByText('Body Part Growth')).toBeVisible()
    await expect(page.getByText('Strength Changes')).toBeVisible()

    const trendsHasHorizontalOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(trendsHasHorizontalOverflow).toBe(false)
  })
})

function issueMcSessionValue() {
  const username = requireEnv('MC_USERNAME')
  const secret = requireEnv('MC_SESSION_SECRET')
  const exp = Math.floor(Date.now() / 1000) + 60 * 60
  const payloadB64 = Buffer.from(JSON.stringify({ u: username, exp }), 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url')
  return `${payloadB64}.${sig}`
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be set for Playwright workout smoke`)
  return value
}

function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const contents = fs.readFileSync(filePath, 'utf8')
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}
