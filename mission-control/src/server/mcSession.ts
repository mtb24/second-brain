import { createHmac, timingSafeEqual } from 'node:crypto'

export const MC_SESSION_COOKIE = 'mc_session'

type Payload = { u: string; exp: number }

function getSecret(): string {
  const s = process.env.MC_SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('MC_SESSION_SECRET must be set (min 32 characters)')
  }
  return s
}

function signPayloadB64(payloadB64: string): string {
  return createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url')
}

export function sessionTtlSeconds(): number {
  const days = Number(process.env.MC_SESSION_TTL_DAYS ?? '7')
  const d = Number.isFinite(days) && days > 0 ? days : 7
  return Math.floor(d * 24 * 60 * 60)
}

export function mcSessionCookieSerializeOptions(): {
  httpOnly: boolean
  sameSite: 'strict'
  secure: boolean
  path: string
  maxAge: number
} {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionTtlSeconds(),
  }
}

export function issueMcSessionValue(username: string): string {
  const expectedUser = process.env.MC_USERNAME
  if (!expectedUser) throw new Error('MC_USERNAME must be set')
  const exp = Math.floor(Date.now() / 1000) + sessionTtlSeconds()
  const payload: Payload = { u: username, exp }
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  )
  const sig = signPayloadB64(payloadB64)
  return `${payloadB64}.${sig}`
}

export function verifyMcSessionValue(
  raw: string | undefined | null,
): boolean {
  if (!raw) return false
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return false
  const payloadB64 = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  if (!payloadB64 || !sig) return false
  const expectedSig = signPayloadB64(payloadB64)
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length) return false
  if (!timingSafeEqual(a, b)) return false
  let payload: Payload
  try {
    const json = Buffer.from(payloadB64, 'base64url').toString('utf8')
    payload = JSON.parse(json) as Payload
  } catch {
    return false
  }
  if (typeof payload.exp !== 'number' || typeof payload.u !== 'string')
    return false
  if (payload.exp < Math.floor(Date.now() / 1000)) return false
  const expectedUser = process.env.MC_USERNAME
  if (!expectedUser || payload.u !== expectedUser) return false
  return true
}

function parseCookieHeader(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const name = part.slice(0, idx).trim()
    if (name === MC_SESSION_COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim())
    }
  }
  return undefined
}

export function verifyMcSessionRequest(request: Request): boolean {
  const raw = parseCookieHeader(request.headers.get('cookie'))
  return verifyMcSessionValue(raw)
}
