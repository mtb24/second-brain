import {
  ExchangeAdapter, Candle, OrderBook, Position,
  OrderRequest, OrderResult, PnL,
} from './adapter.js'
import { fetchPrice, fetchCandles } from './prices.js'

const SLIPPAGE = 0.0005   // 0.05%
const WALK_STEP = 0.002   // ±0.1% per call

interface MockState {
  balance: number
  startingBalance: number
  positions: Map<string, Position>
  orders: OrderResult[]
  realisedPnl: number
}

export class MockAdapter implements ExchangeAdapter {
  readonly name = 'mock'
  readonly isLive = false

  // Simulated prices — seeded from real CoinGecko on first fetch, then random-walked
  private priceCache = new Map<string, number>()

  /**
   * When set, getOrderBook / marks use this mid for the current tick (no extra CoinGecko).
   * Orchestrator sets this from the shared snapshot before each coordinated tick.
   */
  private sharedTickMids: Map<string, number> | null = null

  /** Anchor mock marks to shared exchange mids for this tick (uppercase symbols). */
  setSharedTickPrices(prices: Record<string, number>): void {
    this.sharedTickMids = new Map(
      Object.entries(prices).map(([s, p]) => [s.toUpperCase(), p])
    )
  }

  clearSharedTickPrices(): void {
    this.sharedTickMids = null
  }

  private async _getSimulatedPrice(symbol: string): Promise<number> {
    const symU = symbol.toUpperCase()
    if (this.sharedTickMids?.has(symU)) {
      return this.sharedTickMids.get(symU)!
    }
    if (!this.priceCache.has(symbol)) {
      this.priceCache.set(symbol, await fetchPrice(symbol))
    }
    const current = this.priceCache.get(symbol)!
    const next = current * (1 + (Math.random() - 0.5) * WALK_STEP)
    this.priceCache.set(symbol, next)
    return next
  }

  private state: MockState = {
    balance: 1000,
    startingBalance: 1000,
    positions: new Map(),
    orders: [],
    realisedPnl: 0,
  }

  async initialize(startingBalance: number): Promise<void> {
    this.state = {
      balance: startingBalance,
      startingBalance,
      positions: new Map(),
      orders: [],
      realisedPnl: 0,
    }
  }

  async reset(): Promise<void> {
    await this.initialize(this.state.startingBalance)
  }

  async getPrice(symbol: string): Promise<number> {
    return this._getSimulatedPrice(symbol)
  }

  async getCandles(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    count: number
  ): Promise<Candle[]> {
    return fetchCandles(symbol, interval, count)
  }

  async getOrderBook(symbol: string): Promise<OrderBook> {
    const price = await this._getSimulatedPrice(symbol)
    const spread = price * 0.001
    return {
      bids: [[price - spread * 0.5, 1], [price - spread, 2], [price - spread * 1.5, 3],
             [price - spread * 2, 4], [price - spread * 2.5, 5]],
      asks: [[price + spread * 0.5, 1], [price + spread, 2], [price + spread * 1.5, 3],
             [price + spread * 2, 4], [price + spread * 2.5, 5]],
    }
  }

  async getFundingRate(_symbol: string): Promise<number> {
    return 0
  }

  async getBalance(): Promise<number> {
    return this.state.balance
  }

  async getPositions(): Promise<Position[]> {
    const prices = await Promise.all(
      [...this.state.positions.keys()].map((s) => this._getSimulatedPrice(s))
    )
    const symbols = [...this.state.positions.keys()]
    return symbols.map((sym, i) => {
      const pos = this.state.positions.get(sym)!
      const markPrice = prices[i]
      const pnlFactor = pos.side === 'long'
        ? (markPrice - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - markPrice) / pos.entryPrice
      return { ...pos, markPrice, unrealisedPnl: pnlFactor * pos.size }
    })
  }

  async getOpenOrders(): Promise<OrderResult[]> {
    return [...this.state.orders]
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const fillPrice = await this._getSimulatedPrice(order.symbol) * (1 + (order.side === 'buy' ? SLIPPAGE : -SLIPPAGE))
    const existing = this.state.positions.get(order.symbol)

    if (existing) {
      await this._closePosition(order.symbol)
    }

    this.state.positions.set(order.symbol, {
      symbol: order.symbol,
      side: order.side === 'buy' ? 'long' : 'short',
      size: order.size,
      entryPrice: fillPrice,
      markPrice: fillPrice,
      unrealisedPnl: 0,
      leverage: order.leverage,
    })

    const result: OrderResult = {
      orderId: `mock-${Date.now()}`,
      status: 'ok',
      fillPrice,
    }
    this.state.orders.push(result)
    return result
  }

  async closePosition(symbol: string): Promise<OrderResult> {
    return this._closePosition(symbol)
  }

  private async _closePosition(symbol: string): Promise<OrderResult> {
    const pos = this.state.positions.get(symbol)
    if (!pos) return { orderId: 'noop', status: 'ok' }

    const exitPrice = await this._getSimulatedPrice(symbol) * (1 + (pos.side === 'long' ? -SLIPPAGE : SLIPPAGE))
    const pnlFactor = pos.side === 'long'
      ? (exitPrice - pos.entryPrice) / pos.entryPrice
      : (pos.entryPrice - exitPrice) / pos.entryPrice
    const pnl = pnlFactor * pos.size

    this.state.realisedPnl += pnl
    this.state.balance += pnl
    this.state.positions.delete(symbol)

    return { orderId: `mock-close-${Date.now()}`, status: 'ok', fillPrice: exitPrice }
  }

  async cancelAllOrders(): Promise<void> {
    this.state.orders = []
  }

  async getPnL(): Promise<PnL> {
    const positions = await this.getPositions()
    const unrealised = positions.reduce((sum, p) => sum + p.unrealisedPnl, 0)
    return {
      realised: this.state.realisedPnl,
      unrealised,
      total: this.state.realisedPnl + unrealised,
      startingBalance: this.state.startingBalance,
      currentBalance: this.state.balance,
    }
  }
}
