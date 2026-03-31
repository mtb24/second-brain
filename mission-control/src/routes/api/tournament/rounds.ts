// src/routes/api/tournament/rounds.ts
import { createFileRoute } from '@tanstack/react-router'
import { guardMcApi } from '@/server/requireMcApi'
import pg from 'pg'
const { Pool } = pg
let pool: InstanceType<typeof Pool> | null = null
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DB_URL ?? process.env.DATABASE_URL })
  return pool
}
export const Route = createFileRoute('/api/tournament/rounds')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = guardMcApi(request)
        if (denied) return denied
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') ?? 10)
        const db = getPool()
        const { rows: rounds } = await db.query(
          `SELECT id, started_at, ended_at, status, generation, duration_seconds
           FROM tournament_rounds ORDER BY started_at DESC LIMIT $1`, [limit])
        if (rounds.length === 0) return Response.json({ rounds: [] })
        const roundIds = rounds.map((r: any) => r.id)
        const { rows: perfs } = await db.query(
          `SELECT tp.round_id, tp.bot_id, tp.strategy_id, tp.pnl, tp.pnl_percent,
             tp.fitness_score, tp.total_trades, tp.win_rate,
             ts.name AS strategy_name, ts.tier, tb.name AS bot_name
           FROM tournament_performance tp
           JOIN tournament_strategies ts ON ts.id = tp.strategy_id
           JOIN tournament_bots tb ON tb.id = tp.bot_id
           WHERE tp.round_id = ANY($1)
           ORDER BY tp.round_id DESC, tp.fitness_score DESC`, [roundIds])
        const perfByRound: Record<number, any[]> = {}
        for (const p of perfs) {
          if (!perfByRound[p.round_id]) perfByRound[p.round_id] = []
          perfByRound[p.round_id].push({
            botId: p.bot_id, botName: p.bot_name, strategyId: p.strategy_id,
            strategyName: p.strategy_name, tier: p.tier, pnl: Number(p.pnl),
            pnlPercent: Number(p.pnl_percent), fitnessScore: Number(p.fitness_score),
            totalTrades: p.total_trades, winRate: Number(p.win_rate),
          })
        }
        const result = rounds.map((r: any) => ({
          id: r.id, startedAt: r.started_at, endedAt: r.ended_at,
          status: r.status, generation: r.generation, durationSeconds: r.duration_seconds,
          bots: perfByRound[r.id] ?? [], winner: (perfByRound[r.id] ?? [])[0] ?? null,
        }))
        return Response.json({ rounds: result })
      },
    },
  },
})
