import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg

loadEnv(path.resolve(process.cwd(), '..', '.env'))
loadEnv(path.resolve(process.cwd(), '.env'))

const connectionString = process.env.DB_URL ?? process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DB_URL or DATABASE_URL must be set before running workout migrations')
}

const pool = new Pool({ connectionString })

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workout_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const migrationsDir = path.resolve(process.cwd(), 'drizzle')
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const id = file.replace(/\.sql$/, '')
    const existing = await pool.query('SELECT id FROM workout_migrations WHERE id = $1', [id])
    if (existing.rowCount) {
      console.log(`workout migration ${id} already applied`)
      continue
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    await pool.query('BEGIN')
    try {
      await pool.query(sql)
      await pool.query('INSERT INTO workout_migrations (id) VALUES ($1)', [id])
      await pool.query('COMMIT')
      console.log(`applied workout migration ${id}`)
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }
  }
} finally {
  await pool.end()
}

function loadEnv(filePath) {
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
