import { Pool } from 'pg'
import { Strategy, Bot, BotPerformance } from '../bot/types.js'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DB_URL })
  return pool
}

// ── Strategies ───────────────────────────────────────────────────────────────

export async function insertStrategy(
  s: Omit<Strategy, 'id' | 'createdAt'>
): Promise<Strategy> {
  const db = getPool()
  const { rows } = await db.query(
    `INSERT INTO tournament_strategies
       (name, generation, tier, status, source, parent_ids, doc)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, created_at`,
    [s.name, s.generation, s.tier, s.status, s.source, s.parentIds, s.doc]
  )
  return { ...s, id: rows[0].id, createdAt: rows[0].created_at }
}

export async function getStrategiesByStatus(status: string): Promise<Strategy[]> {
  const db = getPool()
  const { rows } = await db.query(
    `SELECT id, name, generation, tier, status, source, parent_ids, doc, created_at
     FROM tournament_strategies WHERE status = $1 ORDER BY created_at DESC`,
    [status]
  )
  return rows.map((r) => ({
    id: r.id, name: r.name, generation: r.generation,
    tier: r.tier, status: r.status, source: r.source,
    parentIds: r.parent_ids, doc: r.doc, createdAt: r.created_at,
  }))
}

export async function updateStrategyStatus(id: string, status: string): Promise<void> {
  const db = getPool()
  await db.query(
    `UPDATE tournament_strategies SET status=$1, updated_at=NOW() WHERE id=$2`,
    [status, id]
  )
}

// ── Rounds ───────────────────────────────────────────────────────────────────

export async function createRound(
  generation: number,
  durationSeconds: number
): Promise<string> {
  const db = getPool()
  const { rows } = await db.query(
    `INSERT INTO tournament_rounds (generation, duration_seconds)
     VALUES ($1, $2) RETURNING id`,
    [generation, durationSeconds]
  )
  return rows[0].id as string
}

export async function updateRoundStatus(id: string, status: string): Promise<void> {
  const db = getPool()
  const extra = status === 'running' ? ', started_at=NOW()' : status === 'complete' ? ', ended_at=NOW()' : ''
  await db.query(
    `UPDATE tournament_rounds SET status=$1${extra} WHERE id=$2`,
    [status, id]
  )
}

// ── Bots ─────────────────────────────────────────────────────────────────────

export async function createBot(bot: Omit<Bot, 'id'>): Promise<string> {
  const db = getPool()
  const { rows } = await db.query(
    `INSERT INTO tournament_bots
       (name, round_id, strategy_id, status, starting_balance)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [bot.name, bot.roundId, bot.strategyId, bot.status, bot.startingBalance]
  )
  return rows[0].id as string
}

export async function updateBotStatus(
  id: string,
  status: string,
  finalBalance?: number
): Promise<void> {
  const db = getPool()
  if (finalBalance !== undefined) {
    await db.query(
      `UPDATE tournament_bots SET status=$1, final_balance=$2 WHERE id=$3`,
      [status, finalBalance, id]
    )
  } else {
    await db.query(`UPDATE tournament_bots SET status=$1 WHERE id=$2`, [status, id])
  }
}

// ── Ticks ─────────────────────────────────────────────────────────────────────

export interface TickRecord {
  roundId: string
  botId: string
  strategyId: string
  strategyName: string
  balance: number
  pnl: number
  pnlPercent: number
}

export async function saveTick(tick: TickRecord): Promise<void> {
  const db = getPool()
  await db.query(
    `INSERT INTO tournament_ticks
       (round_id, bot_id, strategy_id, strategy_name, balance, pnl, pnl_percent)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [tick.roundId, tick.botId, tick.strategyId, tick.strategyName,
     tick.balance, tick.pnl, tick.pnlPercent]
  )
}

// ── Performance ───────────────────────────────────────────────────────────────

export async function savePerformance(perf: BotPerformance): Promise<void> {
  const db = getPool()
  await db.query(
    `INSERT INTO tournament_performance
       (bot_id, round_id, strategy_id, pnl, pnl_percent, max_drawdown,
        total_trades, winning_trades, win_rate, sharpe_ratio, fitness_score)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [perf.botId, perf.roundId, perf.strategyId, perf.pnl, perf.pnlPercent,
     perf.maxDrawdown, perf.totalTrades, perf.winningTrades, perf.winRate,
     perf.sharpeRatio, perf.fitnessScore]
  )
}

export async function getRoundPerformance(roundId: string): Promise<BotPerformance[]> {
  const db = getPool()
  const { rows } = await db.query(
    `SELECT bot_id,round_id,strategy_id,pnl,pnl_percent,max_drawdown,
            total_trades,winning_trades,win_rate,sharpe_ratio,fitness_score,
            1000 AS starting_balance, 1000 AS final_balance
     FROM tournament_performance WHERE round_id=$1 ORDER BY fitness_score DESC`,
    [roundId]
  )
  return rows.map((r) => ({
    botId: r.bot_id, roundId: r.round_id, strategyId: r.strategy_id,
    startingBalance: Number(r.starting_balance), finalBalance: Number(r.final_balance),
    pnl: Number(r.pnl), pnlPercent: Number(r.pnl_percent),
    maxDrawdown: Number(r.max_drawdown), totalTrades: r.total_trades,
    winningTrades: r.winning_trades, winRate: Number(r.win_rate),
    sharpeRatio: Number(r.sharpe_ratio), fitnessScore: Number(r.fitness_score),
  }))
}
