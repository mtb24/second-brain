/**
 * tournament/src/orchestrator.ts
 * Phase 2 — Tournament Orchestrator
 *
 * Manages round lifecycle: strategy selection, bot spawning (configurable count),
 * parallel execution with shared market conditions, performance recording,
 * and post-round strategy evolution (research new strategies when slots exceed supply).
 */

import Anthropic from '@anthropic-ai/sdk'
import type { DecisionContext } from './bot/decision.js'
import { getStrategySignal } from './bot/decision.js'
import { buildSharedMarketData } from './bot/marketSnapshot.js'
import {
  classifyRegime,
  formatRegimeConsoleLine,
  type RegimeSnapshot,
} from './bot/regime.js'
import { BotRunner, RunnerOptions } from './bot/runner.js'
import { Strategy, Bot, BotPerformance } from './bot/types.js'
import { MockAdapter } from './exchange/mock.js'
import {
  createRound,
  updateRoundStatus,
  createBot,
  updateBotStatus,
  savePerformance,
  getRoundPerformance,
  insertStrategy,
  getStrategiesByStatus,
  updateStrategyStatus,
} from './db/tournament.js'
import { logDecisionToOB1, logRegimeSnapshotToOB1 } from './db/ingest.js'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface OrchestratorConfig {
  /** Number of bots competing per round. Default: 3 */
  botCount: number
  /** Starting balance per bot in USD. Default: 10000 */
  startingBalance: number
  /** Round duration in seconds. Default: 600 (10 min) */
  roundDurationSeconds: number
  /** Decision interval per bot in seconds. Default: 60 */
  decisionIntervalSeconds: number
  /** Symbols to trade. Default: ['BTC', 'ETH'] */
  symbols: string[]
  /** Fitness threshold for a strategy to be considered "good". Default: 0 (any profit) */
  fitnessThreshold: number
  /** Dry run — no real orders. Default: true */
  dryRun: boolean
  /** Verbose logging. Default: true */
  verbose: boolean
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  botCount: Number(process.env.TOURNAMENT_BOT_COUNT ?? 3),
  startingBalance: Number(process.env.TOURNAMENT_STARTING_BALANCE ?? 10000),
  roundDurationSeconds: Number(process.env.TOURNAMENT_ROUND_DURATION ?? 600),
  decisionIntervalSeconds: Number(process.env.TOURNAMENT_DECISION_INTERVAL ?? 60),
  symbols: (process.env.TOURNAMENT_SYMBOLS ?? 'BTC').split(','),
  fitnessThreshold: Number(process.env.TOURNAMENT_FITNESS_THRESHOLD ?? 0),
  dryRun: process.env.DRY_RUN !== 'false',
  verbose: process.env.TOURNAMENT_VERBOSE !== 'false',
}

// ---------------------------------------------------------------------------
// Round result
// ---------------------------------------------------------------------------

export interface RoundResult {
  roundId: string
  generation: number
  performances: BotPerformance[]
  winner: BotPerformance
  newStrategies: Strategy[]
  durationMs: number
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class TournamentOrchestrator {
  private config: OrchestratorConfig
  private anthropic: Anthropic
  private currentGeneration = 0

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  // ── Public entry point ────────────────────────────────────────────────────

  async startRound(): Promise<RoundResult> {
    const startMs = Date.now()
    this.log(`\n${'='.repeat(60)}`)
    this.log(`[ORCHESTRATOR] Starting round | bots: ${this.config.botCount}`)
    this.log(`${'='.repeat(60)}`)

    // 1. Resolve generation
    const generation = await this._resolveGeneration()

    // 2. Select strategies — research new ones if needed
    const strategies = await this._selectStrategies(this.config.botCount)

    // 3. Create round record
    const roundId = await createRound(generation, this.config.roundDurationSeconds)
    await updateRoundStatus(roundId, 'running')
    this.log(`[ORCHESTRATOR] Round ${roundId} created (gen ${generation})`)

    await this._pollRegimeBeforeRound(roundId, strategies)

    // 4. Spawn bots
    const bots = await this._spawnBots(roundId, strategies)

    // 5. Run all bots in parallel with shared market conditions
    const performances = await this._runParallel(bots, strategies, roundId)

    // 6. Save performance records
    for (const perf of performances) {
      await savePerformance(perf)
    }

    // 7. Mark round complete
    await updateRoundStatus(roundId, 'complete')

    // 8. Rank and evolve
    const ranked = [...performances].sort((a, b) => b.fitnessScore - a.fitnessScore)
    const winner = ranked[0]
    this.log(`\n[ORCHESTRATOR] Round complete. Winner: strategy ${winner.strategyId} | fitness: ${winner.fitnessScore.toFixed(2)}%`)

    // 9. Promote winner, retire losers below threshold
    await this._evolve(ranked, strategies)

    // 10. Log summary to OB1
    await this._logSummaryToOB1(roundId, generation, ranked, strategies)

    const newStrategies = await getStrategiesByStatus('proposed')

    return {
      roundId,
      generation,
      performances: ranked,
      winner,
      newStrategies,
      durationMs: Date.now() - startMs,
    }
  }

  // ── Strategy selection ────────────────────────────────────────────────────

  private async _selectStrategies(count: number): Promise<Strategy[]> {
    const active = await getStrategiesByStatus('active')

    if (active.length >= count) {
      // Enough active strategies — pick top N by most recent
      return active.slice(0, count)
    }

    // Not enough — research new ones to fill slots
    const needed = count - active.length
    this.log(`[ORCHESTRATOR] Need ${needed} more strategies — researching...`)
    const researched = await this._researchNewStrategies(needed, active)

    // Insert new strategies as 'active' (they passed research gate)
    const inserted: Strategy[] = []
    for (const s of researched) {
      const strategy = await insertStrategy({
        ...s,
        status: 'active',
        source: 'master',
        generation: this.currentGeneration,
        parentIds: [],
      })
      inserted.push(strategy)
      this.log(`[ORCHESTRATOR] New strategy: "${strategy.name}"`)
    }

    return [...active, ...inserted].slice(0, count)
  }

  private async _researchNewStrategies(
    count: number,
    existing: Strategy[]
  ): Promise<Omit<Strategy, 'id' | 'createdAt'>[]> {
    const existingNames = existing.map((s) => s.name).join(', ')

    const prompt = `You are a quantitative trading strategist. Generate ${count} new trading strategy(s) for a crypto tournament.

Existing strategies already in play: ${existingNames || 'none'}

Requirements:
- Each strategy must be distinct from existing ones and from each other
- Strategies must be potentially profitable (not random or trivially bad)
- Cover different market conditions (trend-following, mean reversion, volatility, etc.)
- Be concrete and actionable — the strategy doc should tell a trading bot exactly when to buy, sell, hold, or close

For each strategy return a JSON object with:
{
  "name": "short-kebab-case-name",
  "tier": "conservative" | "balanced" | "aggressive",
  "doc": "Generate the strategy doc using ONLY this format:

You are a [strategy-name] trader. BTC only.
- If [condition using 1h change % or 24h change % from the prompt],
  [ACTION] with [X]% of balance at [Y]x leverage.
- If [exit condition], CLOSE.
- Otherwise HOLD.
Respond with JSON only. Never explain your reasoning.

When writing the doc value, follow these RULES (do NOT output the RULES list itself):
- Never use 'Compute', 'Calculate', 'I need to', or any reasoning language
- Only reference data that is already in the decision prompt: current price, 1h change %, 24h change %, balance, open positions
- Never reference RSI, SMA, Bollinger Bands, or any indicator that requires calculation from candle data
- Do NOT add any extra bullets or any other text beyond the 3 bullets shown above (entry, exit, otherwise)
- Keep rules to 3-5 bullet points max
- Use [ACTION] as exactly BUY or SELL only (no '(short)'/'(long)' labels)
- Always end with: Respond with JSON only. Never explain your reasoning."
}

Return a JSON array of ${count} strategy objects. No markdown fences, just raw JSON. Ensure each strategy's doc is a valid JSON string (use \\n for new lines).`

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    try {
      const parsed = JSON.parse(text)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      return arr.map((s: any) => ({
        name: s.name,
        tier: s.tier ?? 'balanced',
        status: 'active' as const,
        source: 'master' as const,
        generation: this.currentGeneration,
        parentIds: [],
        doc: this._sanitizeStrategyDoc(s.name, s.doc),
      }))
    } catch (err) {
      this.log(`[ORCHESTRATOR] Failed to parse researched strategies: ${err}`)
      // Fallback: ask Claude for a single named strategy rather than using a timestamp
      try {
        const fallback = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Give me a short kebab-case trading strategy name (2-3 words, no numbers). Reply with only the name, nothing else.' }],
        })
        const fallbackName = fallback.content[0].type === 'text'
          ? fallback.content[0].text.trim().toLowerCase().replace(/[^a-z-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
          : 'adaptive-rsi'
        return [{
          name: fallbackName,
          tier: 'balanced',
          status: 'active',
          source: 'master',
          generation: this.currentGeneration,
          parentIds: [],
          doc: this._fallbackDeclarativeDoc(fallbackName),
        }]
      } catch {
        return [{
          name: 'adaptive-rsi',
          tier: 'balanced',
          status: 'active',
          source: 'master',
          generation: this.currentGeneration,
          parentIds: [],
          doc: this._fallbackDeclarativeDoc('adaptive-rsi'),
        }]
      }
    }
  }

  private _fallbackDeclarativeDoc(strategyName: string): string {
    const name = typeof strategyName === 'string' && strategyName.trim()
      ? strategyName.trim().toLowerCase()
      : 'adaptive-rsi'
    return this._templateDocForStrategy(name)
  }

  private _buildDeclarativeDoc(
    strategyName: string,
    entryCondition: string,
    entryAction: 'BUY' | 'SELL',
    entryPct: string,
    leverage: string,
    exitCondition: string,
  ): string {
    return `You are a ${strategyName} trader. BTC only.
- If ${entryCondition}, ${entryAction} with ${entryPct}% of balance at ${leverage}x leverage.
- If ${exitCondition}, CLOSE.
- Otherwise HOLD.
Respond with JSON only. Never explain your reasoning.`
  }

  private _templateDocForStrategy(name: string): string {
    const presets: Record<string, {
      entryCondition: string
      entryAction: 'BUY' | 'SELL'
      entryPct: string
      leverage: string
      exitCondition: string
    }> = {
      'dip-buyer': {
        entryCondition: 'open positions is none and (24h change % >= 0.1 or 24h change % <= -0.1)',
        entryAction: 'BUY',
        entryPct: '35',
        leverage: '2',
        exitCondition: 'open positions includes side long and pnl >= 8 or pnl <= -6',
      },
      'trend-rider': {
        entryCondition: 'open positions is none and (24h change % >= 0.1 or 24h change % <= -0.1)',
        entryAction: 'BUY',
        entryPct: '40',
        leverage: '3',
        exitCondition: 'open positions includes side long and pnl >= 10 or pnl <= -7',
      },
      'volatility-fade': {
        entryCondition: 'open positions is none and (24h change % >= 0.1 or 24h change % <= -0.1)',
        entryAction: 'SELL',
        entryPct: '30',
        leverage: '2',
        exitCondition: 'open positions includes side short and pnl >= 8 or pnl <= -6',
      },
      'momentum-breakout': {
        entryCondition: 'open positions is none and (24h change % >= 0.1 or 24h change % <= -0.1)',
        entryAction: 'BUY',
        entryPct: '30',
        leverage: '2',
        exitCondition: 'open positions includes side long and pnl >= 6 or pnl <= -5',
      },
      'funding-rate-fade': {
        entryCondition: 'open positions is none and (24h change % >= 0.1 or 24h change % <= -0.1)',
        entryAction: 'BUY',
        entryPct: '30',
        leverage: '2',
        exitCondition: 'open positions includes side long and pnl >= 6 or pnl <= -5',
      },
      'range-reversal': {
        entryCondition: 'open positions is none and (24h change % >= 0.1 or 24h change % <= -0.1)',
        entryAction: 'BUY',
        entryPct: '45',
        leverage: '3',
        exitCondition: 'open positions includes side long and pnl >= 9 or pnl <= -7',
      },
    }

    const p = presets[name] ?? {
      entryCondition: '1h change % >= 0.1 and open positions is none',
      entryAction: 'BUY' as const,
      entryPct: '25',
      leverage: '2',
      exitCondition: 'open positions pnl >= 6 or pnl <= -5',
    }

    return this._buildDeclarativeDoc(
      name,
      p.entryCondition,
      p.entryAction,
      p.entryPct,
      p.leverage,
      p.exitCondition,
    )
  }

  private _sanitizeStrategyDoc(strategyName: string, _rawDoc: unknown): string {
    const name = typeof strategyName === 'string' && strategyName.trim()
      ? strategyName.trim().toLowerCase()
      : 'adaptive-rsi'
    return this._templateDocForStrategy(name)
  }

  // ── Pre-round regime signals (dry-run, no allocation impact) ────────────

  private async _pollRegimeBeforeRound(roundId: string, strategies: Strategy[]): Promise<void> {
    const symbols = this.config.symbols
    const adapter = new MockAdapter()
    await adapter.initialize(this.config.startingBalance)

    let marketData: DecisionContext['marketData']
    try {
      marketData = await buildSharedMarketData(symbols, adapter)
    } catch (err) {
      this.log(`[ORCHESTRATOR] Regime poll: market data failed: ${err}`)
      return
    }

    if (Object.keys(marketData).length === 0) {
      this.log('[ORCHESTRATOR] Regime poll: no market data — skipping')
      return
    }

    const tasks = strategies.map(async (strategy) => {
      const ctx: DecisionContext = {
        strategy,
        balance: this.config.startingBalance,
        positions: [],
        roundTimeRemainingSeconds: this.config.roundDurationSeconds,
        pnlSoFar: 0,
        marketData,
      }
      return getStrategySignal(ctx, strategy.name)
    })
    const signals = await Promise.all(tasks)
    const regimeLabel = classifyRegime(signals)
    const primarySym = symbols[0] ?? 'BTC'
    const firstPrice = Object.values(marketData)[0]?.price
    const marketPrice = marketData[primarySym]?.price ?? firstPrice ?? 0

    const snapshot: RegimeSnapshot = {
      roundId,
      timestamp: new Date().toISOString(),
      marketPrice,
      signals,
      regimeLabel,
    }

    this.log(formatRegimeConsoleLine(snapshot))

    try {
      await logRegimeSnapshotToOB1(snapshot)
    } catch (err) {
      this.log(`[ORCHESTRATOR] Regime OB1 log failed (non-fatal): ${err}`)
    }
  }

  // ── Bot spawning ──────────────────────────────────────────────────────────

  private async _spawnBots(roundId: string, strategies: Strategy[]): Promise<Bot[]> {
    const bots: Bot[] = []
    for (const strategy of strategies) {
      const botName = strategy.name
      const botId = await createBot({
        name: botName,
        roundId,
        strategyId: strategy.id,
        startingBalance: this.config.startingBalance,
        status: 'running',
      })
      bots.push({
        id: botId,
        name: botName,
        strategyId: strategy.id,
        startingBalance: this.config.startingBalance,
        roundId,
        status: 'running',
      })
      this.log(`[ORCHESTRATOR] Spawned bot: ${botName}`)
    }
    return bots
  }

  // ── Parallel execution ────────────────────────────────────────────────────

  private async _runParallel(
    bots: Bot[],
    strategies: Strategy[],
    roundId: string
  ): Promise<BotPerformance[]> {
    this.log(`\n[ORCHESTRATOR] Running ${bots.length} bots in parallel...`)

    const runnerOptions: Partial<RunnerOptions> = {
      roundDurationSeconds: this.config.roundDurationSeconds,
      decisionIntervalSeconds: this.config.decisionIntervalSeconds,
      symbols: this.config.symbols,
      verbose: this.config.verbose,
    }

    // Each bot gets its own MockAdapter so portfolio state is isolated
    // All bots see the same real market data (fetched independently per tick)
    const tasks = bots.map((bot) => {
      const strategy = strategies.find((s) => s.id === bot.strategyId)!
      const adapter = new MockAdapter()
      const runner = new BotRunner(bot, strategy, adapter, runnerOptions)
      return runner.start().then(async (perf) => {
        await updateBotStatus(bot.id, 'finished', perf.finalBalance)
        return perf
      }).catch(async (err) => {
        this.log(`[ORCHESTRATOR] Bot ${bot.name} failed: ${err}`)
        await updateBotStatus(bot.id, 'finished', bot.startingBalance)
        // Return a zero-performance record so the round still completes
        return {
          botId: bot.id,
          roundId,
          strategyId: bot.strategyId,
          startingBalance: bot.startingBalance,
          finalBalance: bot.startingBalance,
          pnl: 0,
          pnlPercent: 0,
          maxDrawdown: 0,
          totalTrades: 0,
          winningTrades: 0,
          winRate: 0,
          sharpeRatio: 0,
          fitnessScore: 0,
        } as BotPerformance
      })
    })

    return Promise.all(tasks)
  }

  // ── Post-round evolution ──────────────────────────────────────────────────

  private async _evolve(
    ranked: BotPerformance[],
    strategies: Strategy[]
  ): Promise<void> {
    if (ranked.length === 0) return

    const winner = ranked[0]
    const winnerStrategy = strategies.find((s) => s.id === winner.strategyId)

    // Promote winner to hall_of_fame if exceptional (top 10% fitness)
    if (winnerStrategy && winner.fitnessScore > 10) {
      await updateStrategyStatus(winner.strategyId, 'hall_of_fame')
      this.log(`[ORCHESTRATOR] Strategy "${winnerStrategy.name}" promoted to hall_of_fame`)
    }

    // Retire strategies that are consistently below threshold
    for (const perf of ranked.slice(1)) {
      if (perf.fitnessScore < this.config.fitnessThreshold) {
        const strategy = strategies.find((s) => s.id === perf.strategyId)
        if (strategy && strategy.status === 'active') {
          await updateStrategyStatus(perf.strategyId, 'retired')
          this.log(`[ORCHESTRATOR] Strategy "${strategy.name}" retired (fitness: ${perf.fitnessScore.toFixed(2)}%)`)
        }
      }
    }
  }

  // ── OB1 logging ───────────────────────────────────────────────────────────

  private async _logSummaryToOB1(
    roundId: string,
    generation: number,
    ranked: BotPerformance[],
    strategies: Strategy[]
  ): Promise<void> {
    try {
      const lines = ranked.map((p, i) => {
        const s = strategies.find((s) => s.id === p.strategyId)
        return `${i + 1}. ${s?.name ?? p.strategyId}: ${p.pnlPercent.toFixed(2)}% PnL | fitness: ${p.fitnessScore.toFixed(2)}`
      })

      const summary = [
        `Tournament round ${roundId} (gen ${generation}) complete.`,
        `Bots: ${ranked.length} | Duration: ${this.config.roundDurationSeconds}s`,
        '',
        'Results:',
        ...lines,
      ].join('\n')

      await logDecisionToOB1({
        decision: { action: 'hold', reasoning: summary, confidence: 1 },
        bot: { id: 'orchestrator', name: 'tournament-orchestrator', strategyId: '', startingBalance: 0, roundId, status: 'finished' },
        strategyName: 'tournament-summary',
        balance: 0,
        pnl: ranked[0]?.pnl ?? 0,
      })
    } catch (err) {
      this.log(`[ORCHESTRATOR] OB1 log failed (non-fatal): ${err}`)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async _resolveGeneration(): Promise<number> {
    // Simple increment — in future this could query the DB for last round's generation
    this.currentGeneration++
    return this.currentGeneration
  }

  private log(msg: string): void {
    if (this.config.verbose) console.log(msg)
  }
}
