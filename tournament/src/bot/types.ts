export interface Strategy {
  id: string
  name: string
  generation: number
  tier: 'conservative' | 'balanced' | 'aggressive'
  status: 'proposed' | 'approved' | 'active' | 'retired' | 'hall_of_fame'
  source: 'manual' | 'master' | 'bred' | 'mutated'
  parentIds: string[]
  doc: string
  createdAt: Date
}

export interface Bot {
  id: string
  name: string
  strategyId: string
  startingBalance: number
  roundId: string
  status: 'idle' | 'running' | 'paused' | 'finished'
}

export interface TradingDecision {
  action: 'buy' | 'sell' | 'close' | 'hold'
  symbol?: string
  size?: number             // USD notional
  leverage?: number         // 1-50
  orderType?: 'market' | 'limit'
  limitPrice?: number
  reasoning: string
  confidence: number        // 0.0 - 1.0
}

export interface BotPerformance {
  botId: string
  roundId: string
  strategyId: string
  startingBalance: number
  finalBalance: number
  pnl: number
  pnlPercent: number
  maxDrawdown: number
  totalTrades: number
  winningTrades: number
  winRate: number
  sharpeRatio: number
  fitnessScore: number
}
