import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const configDir = path.dirname(fileURLToPath(import.meta.url))

loadEnv(path.resolve(configDir, '..', '.env'))
loadEnv(path.resolve(configDir, '.env'))
process.env.TZ ??= 'America/Los_Angeles'

const port = Number(process.env.PLAYWRIGHT_PORT ?? '4173')
const baseURL = `http://127.0.0.1:${port}`
const workoutTestDbUrl = process.env.WORKOUT_TEST_DB_URL ?? resolveWorkoutTestDbUrlFromDocker()
const webServerEnv = {
  ...stringEnv(process.env),
  ...(workoutTestDbUrl ? { DB_URL: workoutTestDbUrl, DATABASE_URL: workoutTestDbUrl } : {}),
  MC_USERNAME: process.env.MC_USERNAME ?? 'playwright-smoke',
  MC_SESSION_SECRET: process.env.MC_SESSION_SECRET ?? 'local-playwright-session-secret-32-chars',
  OPENCLAW_GATEWAY_URL: process.env.OPENCLAW_GATEWAY_URL ?? 'ws://127.0.0.1:1',
  MCP_URL: process.env.MCP_URL ?? 'http://127.0.0.1:1',
  MCP_TOKEN: process.env.MCP_TOKEN ?? 'local-playwright-smoke',
  INGEST_URL: process.env.INGEST_URL ?? 'http://127.0.0.1:1',
  INGEST_TOKEN: process.env.INGEST_TOKEN ?? 'local-playwright-smoke',
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.playwright.ts',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    timezoneId: 'America/Los_Angeles',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `pnpm exec vite dev --host 127.0.0.1 --port ${port}`,
    cwd: configDir,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: webServerEnv,
  },
})

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

function stringEnv(env: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function resolveWorkoutTestDbUrlFromDocker() {
  const container = process.env.WORKOUT_TEST_DB_CONTAINER ?? 'brain-workout-db-test'
  if (!isDockerContainerRunning(container)) return null

  const env = readDockerContainerEnv(container)
  const user = env.POSTGRES_USER
  const database = env.POSTGRES_DB
  const password = env.POSTGRES_PASSWORD
  if (!user || !database || !password) return null

  const host = process.env.WORKOUT_TEST_DB_HOST ?? '127.0.0.1'
  const port = process.env.WORKOUT_TEST_DB_PORT ?? '55432'
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`
}

function isDockerContainerRunning(container: string) {
  try {
    return execFileSync('docker', ['inspect', '-f', '{{.State.Running}}', container], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() === 'true'
  } catch {
    return false
  }
}

function readDockerContainerEnv(container: string) {
  try {
    const output = execFileSync('docker', ['inspect', '--format', '{{range .Config.Env}}{{println .}}{{end}}', container], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return Object.fromEntries(
      output
        .split(/\r?\n/)
        .map((line) => {
          const index = line.indexOf('=')
          return index === -1 ? null : [line.slice(0, index), line.slice(index + 1)]
        })
        .filter((entry): entry is [string, string] => Boolean(entry)),
    )
  } catch {
    return {}
  }
}
