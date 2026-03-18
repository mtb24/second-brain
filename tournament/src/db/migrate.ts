import 'dotenv/config'
import * as fs from 'fs/promises'
import * as path from 'path'
import { Pool } from 'pg'

async function run(): Promise<void> {
  const dbUrl = process.env.DB_URL
  if (!dbUrl) throw new Error('DB_URL is not set')

  const sqlPath = path.join(__dirname, '../../db/migrations/001_tournament.sql')
  let sql: string
  try {
    sql = await fs.readFile(sqlPath, 'utf-8')
  } catch (err) {
    throw new Error(`Failed to read migration file: ${err}`)
  }

  const pool = new Pool({ connectionString: dbUrl })
  try {
    await pool.query(sql)
    console.log('[migrate] 001_tournament.sql applied successfully')
  } catch (err) {
    console.error('[migrate] Failed:', err)
    throw err
  } finally {
    await pool.end()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
