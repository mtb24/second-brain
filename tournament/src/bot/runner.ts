import { ExchangeAdapter } from '../exchange/adapter.js'
import { makeDecision, DecisionContext } from './decision.js'
import { logDecisionToOB1 } from '../db/ingest.js'
import { saveTick } from '../db/tournament.js'
import { Bot, Strategy, TradingDecision, BotPerformance } from './types.js'

export interface RunnerOptions {
  decisionIntervalSeconds: number // default: 60
  roundDurationSeconds: number // default: 600
  symbols: string[] // default: ['BTC']
  verbose: boolean // default: true
}

const DEFAULT_OPTIONS: RunnerOptions = {
  decisionIntervalSeconds: 60,
  roundDurationSeconds: 600,
  symbols: ['BTC'],
  verbose: true,
}

export class BotRunner {
  private options: RunnerOptions
  private stopped = false
  private totalDecisions = 0
  private actionsTaken = 0
  private holdDecisions = 0
  private roundStartTime = 0

  constructor(
    private bot: Bot,
    private strategy: Strategy,
    private adapter: ExchangeAdapter,
    options: Partial<RunnerOptions> = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  async beginRound(): Promise<void> {
    const { roundDurationSeconds, decisionIntervalSeconds, symbols, verbose } = this.options

    if (this.adapter.isLive) {
      console.warn('[runner] WARNING: isLive=true. Proceeding requires real funds.')
    }

    await this.adapter.initialize(this.bot.startingBalance)
    this.roundStartTime = Date.now()

    if (verbose) {
      console.log(`\n[BOT:${this.bot.name}] Starting round. Strategy: ${this.strategy.name}`)
      console.log(
        `[BOT:${this.bot.name}] Duration: ${roundDurationSeconds}s | Interval: ${decisionIntervalSeconds}s`
      )
    }
  }

  /**
   * One decision tick using pre-fetched shared market data (CoinGecko fetched once in orchestrator).
   */
  async runOneTick(
    shared: DecisionContext['marketData'],
    timeRemaining: number
  ): Promise<void> {
    if (this.stopped) return

    try {
      const [balance, positions] = await Promise.all([
        this.adapter.getBalance(),
        this.adapter.getPositions(),
      ])
      const pnl = await this.adapter.getPnL()

      const marketData: DecisionContext['marketData'] = {}
      for (const sym of Object.keys(shared)) {
        const slice = shared[sym]
        if (!slice) continue
        try {
          const book = await this.adapter.getOrderBook(sym)
          const fundingRate = await this.adapter.getFundingRate(sym)
          marketData[sym] = {
            price: slice.price,
            candles: slice.candles,
            fundingRate,
            change1h: slice.change1h,
            change24h: slice.change24h,
            topBid: book.bids[0]?.[0] ?? slice.price,
            topAsk: book.asks[0]?.[0] ?? slice.price,
          }
        } catch (err) {
          console.error(`[runner] market data error for ${sym}:`, err)
        }
      }

      if (Object.keys(marketData).length === 0) return

      const ctx: DecisionContext = {
        strategy: this.strategy,
        balance,
        positions,
        roundTimeRemainingSeconds: Math.round(timeRemaining),
        pnlSoFar: pnl.total,
        marketData,
      }

      const decision = await makeDecision(ctx, this.bot.name)
      this.totalDecisions++

      if (decision.action === 'hold') {
        this.holdDecisions++
      } else {
        await this._execute(decision)
      }

      await logDecisionToOB1({
        decision,
        bot: this.bot,
        strategyName: this.strategy.name,
        balance,
        pnl: pnl.total,
      })

      const pnlPct = pnl.startingBalance > 0 ? (pnl.total / pnl.startingBalance) * 100 : 0
      saveTick({
        roundId: this.bot.roundId,
        botId: this.bot.id,
        strategyId: this.bot.strategyId,
        strategyName: this.strategy.name,
        balance: pnl.currentBalance,
        pnl: pnl.total,
        pnlPercent: pnlPct,
      }).catch((err) =>
        console.error(`[runner] saveTick FAILED — no tick data will appear: ${err.message}`)
      )
    } catch (err) {
      console.error(`[BOT:${this.bot.name}] tick error:`, err)
    }
  }

  async completeRound(): Promise<BotPerformance> {
    return this._finish(this.roundStartTime)
  }

  async stop(): Promise<void> {
    this.stopped = true
  }

  private async _execute(d: TradingDecision): Promise<void> {
    if (this.adapter.isLive && process.env.DRY_RUN === 'true') {
      console.log(
        `[DRY_RUN] Would execute: ${d.action}${d.symbol ? ' ' + d.symbol : ''}${d.size ? ' $' + d.size : ''}`
      )
      this.actionsTaken++
      return
    }
    try {
      if (d.action === 'close') {
        const positions = await this.adapter.getPositions()
        if (positions.length > 0) {
          for (const p of positions) await this.adapter.closePosition(p.symbol)
          this.actionsTaken++
        } else {
          console.log(`[runner:${this.bot.name}] close action — no open positions, skipped`)
        }
      } else if ((d.action === 'buy' || d.action === 'sell') && d.symbol && d.size) {
        await this.adapter.placeOrder({
          symbol: d.symbol,
          side: d.action,
          size: d.size,
          leverage: d.leverage ?? 1,
          orderType: d.orderType ?? 'market',
          limitPrice: d.limitPrice,
        })
        this.actionsTaken++
      } else if (d.action === 'buy' || d.action === 'sell') {
        console.warn(
          `[runner:${this.bot.name}] ${d.action} skipped — missing symbol or size (symbol=${d.symbol}, size=${d.size})`
        )
      }
    } catch (err) {
      console.error(`[runner] execute error:`, err)
    }
  }

  private async _finish(startTime: number): Promise<BotPerformance> {
    try {
      const positions = await this.adapter.getPositions()
      for (const p of positions) {
        if (!this.adapter.isLive || process.env.DRY_RUN !== 'true') {
          await this.adapter.closePosition(p.symbol)
        }
      }
    } catch (err) {
      console.error('[runner] close positions error:', err)
    }

    const pnl = await this.adapter.getPnL()
    const durationMs = Date.now() - startTime
    const pnlPct = (pnl.total / pnl.startingBalance) * 100

    return {
      botId: this.bot.id,
      roundId: this.bot.roundId,
      strategyId: this.bot.strategyId,
      startingBalance: pnl.startingBalance,
      finalBalance: pnl.currentBalance,
      pnl: pnl.total,
      pnlPercent: pnlPct,
      maxDrawdown: 0,
      totalTrades: this.actionsTaken,
      winningTrades: 0,
      winRate: 0,
      sharpeRatio: 0,
      fitnessScore: pnlPct,
      _meta: { totalDecisions: this.totalDecisions, holdDecisions: this.holdDecisions, durationMs },
    } as BotPerformance & { _meta: unknown }
  }
}
