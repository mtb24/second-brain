import { createFileRoute } from '@tanstack/react-router'
import pg from 'pg'
const { Pool } = pg
let pool: InstanceType<typeof Pool> | null = null
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DB_URL ?? process.env.DATABASE_URL })
  return pool
}

export const Route = createFileRoute('/api/tournament/live')({
  server: {
    handlers: {
      GET: async () => {
        const db = getPool()
        // Prefer running round; fall back to most recent complete
        const { rows: roundRows } = await db.query(
          `SELECT id, status FROM tournament_rounds
           WHERE status IN ('running', 'complete')
           ORDER BY CASE WHEN status='running' THEN 0 ELSE 1 END, started_at DESC
           LIMIT 1`
        )
        if (roundRows.length === 0) {
          return Response.json({ roundId: null, status: null, ticks: [] })
        }
        const round = roundRows[0]
        const { rows: ticks } = await db.query(
          `SELECT strategy_name, balance, pnl_percent, tick_at
           FROM tournament_ticks WHERE round_id=$1 ORDER BY tick_at ASC`,
          [round.id]
        )
        return Response.json({
          roundId: round.id,
          status: round.status,
          ticks: ticks.map((t: any) => ({
            strategyName: t.strategy_name,
            balance: Number(t.balance),
            pnlPercent: Number(t.pnl_percent),
            tickAt: t.tick_at,
          })),
        })
      },
    },
  },
})
