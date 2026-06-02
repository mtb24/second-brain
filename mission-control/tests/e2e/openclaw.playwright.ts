import { createHmac } from 'node:crypto'
import fs from 'node:fs'
import { createServer, type Server } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const specDir = path.dirname(fileURLToPath(import.meta.url))
loadEnv(path.resolve(specDir, '..', '..', '..', '.env'))
loadEnv(path.resolve(specDir, '..', '..', '.env'))
process.env.MC_USERNAME ??= 'playwright-smoke'
process.env.MC_SESSION_SECRET ??= 'local-playwright-session-secret-32-chars'

let openClawStub: Server | null = null

test.describe('OpenClaw embed', () => {
  test.beforeAll(async () => {
    openClawStub = await startOpenClawStubIfPortIsFree()
  })

  test.afterAll(async () => {
    await new Promise<void>((resolve) => {
      if (!openClawStub) {
        resolve()
        return
      }
      openClawStub.close(() => resolve())
    })
  })

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

  test('links to the proxied OpenClaw surface without nesting an iframe', async ({ page }) => {
    await page.goto('/workout')

    const openClawLink = page.getByRole('link', { name: 'OpenClaw' })
    await expect(openClawLink).toBeVisible()
    await expect(openClawLink).toHaveAttribute('href', '/openclaw/')
    await expect(page.locator('header')).toHaveCount(1)
    await expect(page.getByTitle('OpenClaw Control')).toHaveCount(0)

    const hasHorizontalOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(hasHorizontalOverflow).toBe(false)
  })

  test('loads the proxied OpenClaw control surface top-level', async ({ page }) => {
    await page.goto('/openclaw/')

    await expect(page).toHaveTitle(/OpenClaw Control/)
    await expect(page.locator('iframe')).toHaveCount(0)
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
  if (!value) throw new Error(`${name} must be set for Playwright OpenClaw smoke`)
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

async function startOpenClawStubIfPortIsFree() {
  const server = createServer((request, response) => {
    if (request.url?.startsWith('/openclaw') || request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end('<!doctype html><title>OpenClaw Control</title><h1>OpenClaw Control</h1>')
      return
    }
    response.writeHead(404)
    response.end('not found')
  })

  return new Promise<Server | null>((resolve) => {
    server.once('error', () => resolve(null))
    server.listen(18789, '127.0.0.1', () => resolve(server))
  })
}
