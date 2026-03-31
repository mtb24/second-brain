import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { MC_SESSION_COOKIE, verifyMcSessionValue } from './mcSession'

/** Used from root beforeLoad — runs on server (RPC from client navigations). */
export const getMcAuthOk = createServerFn({ method: 'GET' }).handler(async () => {
  const raw = getCookie(MC_SESSION_COOKIE)
  return { ok: verifyMcSessionValue(raw) }
})
