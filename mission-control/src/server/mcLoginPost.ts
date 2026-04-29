import bcrypt from 'bcryptjs'
import { redirect } from '@tanstack/react-router'
import { setCookie } from '@tanstack/react-start/server'
import {
  issueMcSessionValue,
  mcSessionCookieSerializeOptions,
  MC_SESSION_COOKIE,
} from './mcSession'

function redirectToInvalidLogin(): never {
  throw redirect({
    to: '/login',
    search: { error: 'invalid' as const },
    statusCode: 303,
  })
}

export async function handleMcLoginPost(request: Request): Promise<never> {
  const usernameEnv = process.env.MC_USERNAME
  const hashEnv = process.env.MC_PASSWORD_HASH
  if (!usernameEnv || !hashEnv) {
    throw new Error('MC_USERNAME and MC_PASSWORD_HASH must be set')
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    redirectToInvalidLogin()
  }

  const username = String(form.get('username') ?? '').trim()
  const password = String(form.get('password') ?? '')

  const validUser = username === usernameEnv
  const validPass =
    validUser && (await bcrypt.compare(password, hashEnv))

  if (!validPass) {
    redirectToInvalidLogin()
  }

  const token = issueMcSessionValue(usernameEnv)
  setCookie(MC_SESSION_COOKIE, token, mcSessionCookieSerializeOptions())
  throw redirect({ to: '/', statusCode: 303 })
}
