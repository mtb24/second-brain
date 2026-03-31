import { verifyMcSessionRequest } from './mcSession'

export function guardMcApi(request: Request): Response | null {
  if (!verifyMcSessionRequest(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}
