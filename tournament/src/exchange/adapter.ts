export interface Candle {
  timestamp: number   // unix ms
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface OrderBook {
  bids: [number, number][]   // [price, size] sorted descending
  asks: [number, number][]   // [price, size] sorted ascending
}

export interface Position {
  symbol: string
  side: 'long' | 'short'
  size: number               // USD notional
  entryPrice: number
  markPrice: number
  unrealisedPnl: number
  leverage: number
}

export interface OrderRequest {
  symbol: string
  side: 'buy' | 'sell'
  size: number               // USD notional
  leverage: number           // 1x minimum
  orderType: 'market' | 'limit'
  limitPrice?: number
}

export interface OrderResult {
  orderId: string
  status: 'ok' | 'error'
  fillPrice?: number
  message?: string
}

export interface PnL {
  realised: number
  unrealised: number
  total: number
  startingBalance: number
  currentBalance: number
}

export interface ExchangeAdapter {
  readonly name: string
  readonly isLive: boolean

  // Market data
  getPrice(symbol: string): Promise<number>
  getCandles(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    count: number
  ): Promise<Candle[]>
  getOrderBook(symbol: string): Promise<OrderBook>
  getFundingRate(symbol: string): Promise<number>

  // Account state
  getBalance(): Promise<number>
  getPositions(): Promise<Position[]>
  getOpenOrders(): Promise<OrderResult[]>

  // Trading — MUST check DRY_RUN before executing
  placeOrder(order: OrderRequest): Promise<OrderResult>
  closePosition(symbol: string): Promise<OrderResult>
  cancelAllOrders(): Promise<void>

  // Performance
  getPnL(): Promise<PnL>

  // Lifecycle
  initialize(startingBalance: number): Promise<void>
  reset(): Promise<void>
}
