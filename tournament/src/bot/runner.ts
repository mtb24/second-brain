import { ExchangeAdapter } from '../exchange/adapter.js'
import { fetchPrice, fetchCandles } from '../exchange/prices.js'
import { makeDecision, DecisionContext } from './decision.js'
import { logDecisionToOB1 } from '../db/ingest.js'
import { saveTick } from '../db/tournament.js'
import { Bot, Strategy, TradingDecision, BotPerformance } from './types.js'

export interface RunnerOptions {
  decisionIntervalSeconds: number   // default: 60
  roundDurationSeconds: number      // default: 600
  symbols: string[]                 // default: ['BTC', 'ETH']
  verbose: boolean                  // default: true
}

const DEFAULT_OPTIONS: RunnerOptions = {
  decisionIntervalSeconds: 60,
  roundDurationSeconds: 600,
  symbols: ['BTC', 'ETH'],
  verbose: true,
}

export class BotRunner {
  private options: RunnerOptions
  private stopped = false
  private totalDecisions = 0
  private actionsTaken = 0
  private holdDecisions = 0

  constructor(
    private bot: Bot,
    private strategy: Strategy,
    private adapter: ExchangeAdapter,
    options: Partial<RunnerOptions> = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  async start(): Promise<BotPerformance> {
    const { roundDurationSeconds, decisionIntervalSeconds, symbols, verbose } = this.options

    if (this.adapter.isLive) {
      console.warn('[runner] WARNING: isLive=true. Proceeding requires real funds.')
    }

    await this.adapter.initialize(this.bot.startingBalance)
    const startTime = Date.now()

    if (verbose) {
      console.log(`\n[BOT:${this.bot.name}] Starting round. Strategy: ${this.strategy.name}`)
      console.log(`[BOT:${this.bot.name}] Duration: ${roundDurationSeconds}s | Interval: ${decisionIntervalSeconds}s`)
    }

    while (!this.stopped) {
      const elapsed = (Date.now() - startTime) / 1000
      if (elapsed >= roundDurationSeconds) break

      await this._tick(symbols, roundDurationSeconds - elapsed)

      const remaining = roundDurationSeconds - (Date.now() - startTime) / 1000
      if (remaining <= 0) break

      await sleep(Math.min(decisionIntervalSeconds * 1000, remaining * 1000))
    }

    return this._finish(startTime)
  }

  async stop(): Promise<void> {
    this.stopped = true
  }

  private async _tick(symbols: string[], timeRemaining: number): Promise<void> {
    try {
      const [balance, positions] = await Promise.all([
        this.adapter.getBalance(),
        this.adapter.getPositions(),
      ])
      const pnl = await this.adapter.getPnL()

      const marketData: DecisionContext['marketData'] = {}
      for (const sym of symbols) {
        try {
          const [price, candles, book, fundingRate] = await Promise.all([
            fetchPrice(sym),
            fetchCandles(sym, '1h', 24),
            this.adapter.getOrderBook(sym),
            this.adapter.getFundingRate(sym),
          ])
          const change1h = candles.length >= 2
            ? ((candles[candles.length - 1].close - candles[candles.length - 2].close) /
               candles[candles.length - 2].close) * 100
            : 0
          const change24h = candles.length >= 24
            ? ((candles[candles.length - 1].close - candles[0].close) / candles[0].close) * 100
            : 0
          marketData[sym] = {
            price, candles, fundingRate, change1h, change24h,
            topBid: book.bids[0]?.[0] ?? price,
            topAsk: book.asks[0]?.[0] ?? price,
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
        decision, bot: this.bot, strategyName: this.strategy.name,
        balance, pnl: pnl.total,
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
      }).catch((err) => console.error(`[runner] saveTick FAILED — no tick data will appear: ${err.message}`))
    } catch (err) {
      console.error(`[BOT:${this.bot.name}] tick error:`, err)
    }
  }

  private async _execute(d: TradingDecision): Promise<void> {
    if (this.adapter.isLive && process.env.DRY_RUN === 'true') {
      console.log(`[DRY_RUN] Would execute: ${d.action}${d.symbol ? ' ' + d.symbol : ''}${d.size ? ' $' + d.size : ''}`)
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
          symbol: d.symbol, side: d.action,
          size: d.size, leverage: d.leverage ?? 1,
          orderType: d.orderType ?? 'market',
          limitPrice: d.limitPrice,
        })
        this.actionsTaken++
      } else if (d.action === 'buy' || d.action === 'sell') {
        console.warn(`[runner:${this.bot.name}] ${d.action} skipped — missing symbol or size (symbol=${d.symbol}, size=${d.size})`)
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
