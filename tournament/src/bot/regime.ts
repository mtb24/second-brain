import type { StrategySignal } from './decision.js'

export interface RegimeSnapshot {
  roundId: string
  timestamp: string
  marketPrice: number
  signals: StrategySignal[]
  regimeLabel: string
}

/**
 * Simple regime label from aggregate strategy signals (data collection, not allocation).
 */
export function classifyRegime(signals: StrategySignal[]): string {
  const n = signals.length
  if (n === 0) return 'flat'

  const longs = signals.filter((s) => s.signal === 'enter_long')
  const shorts = signals.filter((s) => s.signal === 'enter_short')
  const entering = longs.length + shorts.length

  if (entering === 0) return 'flat'
  if (entering === 1) return 'weak_signal'
  if (longs.length > n / 2) return 'bullish'
  if (shorts.length > n / 2) return 'bearish'
  return 'choppy'
}

export function formatRegimeConsoleLine(
  snapshot: RegimeSnapshot,
): string {
  const { regimeLabel, signals, marketPrice } = snapshot
  const n = signals.length
  const wantEnter = signals.filter((s) => s.signal !== 'hold').length
  const longC = signals.filter((s) => s.signal === 'enter_long').length
  const shortC = signals.filter((s) => s.signal === 'enter_short').length

  let detail: string
  if (wantEnter === 0) {
    detail = 'all hold'
  } else if (longC > 0 && shortC === 0) {
    detail = `${longC}/${n} want to enter long`
  } else if (shortC > 0 && longC === 0) {
    detail = `${shortC}/${n} want to enter short`
  } else {
    detail = `${wantEnter}/${n} want to enter (${longC} long, ${shortC} short)`
  }

  return `[REGIME] ${regimeLabel} — ${wantEnter}/${n} strategies want to enter (${detail}) | BTC $${marketPrice.toFixed(2)}`
}
