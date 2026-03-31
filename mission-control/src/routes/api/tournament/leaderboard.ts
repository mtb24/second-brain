// src/routes/api/tournament/leaderboard.ts
import { createFileRoute } from '@tanstack/react-router'
import { guardMcApi } from '@/server/requireMcApi'
import pg from 'pg'
const { Pool } = pg
let pool: InstanceType<typeof Pool> | null = null
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DB_URL ?? process.env.DATABASE_URL })
  return pool
}
export const Route = createFileRoute('/api/tournament/leaderboard')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardMcApi(request)
        if (denied) return denied
        const db = getPool()
        const { rows } = await db.query(
          `SELECT ts.id, ts.name, ts.tier, ts.status, ts.generation,
             COUNT(tp.id) AS rounds_played,
             SUM(CASE WHEN tp.fitness_score = ranked.top_score THEN 1 ELSE 0 END) AS wins,
             AVG(tp.pnl_percent) AS avg_pnl_percent,
             AVG(tp.fitness_score) AS avg_fitness,
             MAX(tp.fitness_score) AS best_fitness,
             SUM(tp.total_trades) AS total_trades
           FROM tournament_strategies ts
           LEFT JOIN tournament_performance tp ON tp.strategy_id = ts.id
           LEFT JOIN (
             SELECT round_id, MAX(fitness_score) AS top_score
             FROM tournament_performance GROUP BY round_id
           ) ranked ON ranked.round_id = tp.round_id
           WHERE ts.status IN ('active','hall_of_fame','retired')
           GROUP BY ts.id, ts.name, ts.tier, ts.status, ts.generation
           ORDER BY wins DESC, avg_fitness DESC`)
        const leaderboard = rows.map((r: any) => ({
          id: r.id, name: r.name, tier: r.tier, status: r.status, generation: r.generation,
          roundsPlayed: Number(r.rounds_played), wins: Number(r.wins),
          avgPnlPercent: r.avg_pnl_percent ? Number(r.avg_pnl_percent).toFixed(2) : null,
          avgFitness: r.avg_fitness ? Number(r.avg_fitness).toFixed(2) : null,
          bestFitness: r.best_fitness ? Number(r.best_fitness).toFixed(2) : null,
          totalTrades: Number(r.total_trades),
          winRate: r.rounds_played > 0 ? ((Number(r.wins) / Number(r.rounds_played)) * 100).toFixed(1) : null,
        }))
        return Response.json({ leaderboard })
      },
    },
  },
})
