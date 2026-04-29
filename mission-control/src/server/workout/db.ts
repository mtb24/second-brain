import pg from 'pg'
import { verifyMcSessionRequest } from '@/server/mcSession'

const { Pool } = pg

let pool: InstanceType<typeof Pool> | null = null

export function getWorkoutPool() {
  if (!pool) {
    const connectionString = process.env.DB_URL ?? process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DB_URL or DATABASE_URL must be set for workout APIs')
    }
    pool = new Pool({ connectionString })
  }
  return pool
}

export async function withWorkoutTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
) {
  const client = await getWorkoutPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export function guardWorkoutApi(request: Request): Response | null {
  if (verifyMcSessionRequest(request)) return null

  const authHeader = request.headers.get('authorization') ?? ''
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]
  const expected =
    process.env.WORKOUT_API_TOKEN ??
    process.env.INGEST_TOKEN ??
    process.env.MCP_TOKEN ??
    process.env.API_SECRET

  if (expected && bearer === expected) return null

  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  const text = await request.text()
  if (!text.trim()) return {} as T
  return JSON.parse(text) as T
}
