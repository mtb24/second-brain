import { redirect } from '@tanstack/react-router'
import { deleteCookie } from '@tanstack/react-start/server'
import { mcSessionCookieSerializeOptions, MC_SESSION_COOKIE } from './mcSession'

export async function handleMcLogoutPost(): Promise<never> {
  deleteCookie(MC_SESSION_COOKIE, mcSessionCookieSerializeOptions())
  throw redirect({ to: '/login', search: { error: undefined } })
}
