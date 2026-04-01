/**
 * Fetches CoinGecko-backed market slices once per orchestrator tick.
 * All bots consume the same snapshot (see orchestrator coordinated loop).
 */

import type { DecisionContext } from './decision.js'
import { fetchPrices, fetchCandles } from '../exchange/prices.js'

export class MarketDataService {
  async fetchSharedMarketData(symbols: string[]): Promise<DecisionContext['marketData']> {
    const marketData: DecisionContext['marketData'] = {}
    let prices: Record<string, number> = {}
    try {
      prices = await fetchPrices(symbols)
    } catch (err) {
      console.error('[marketDataService] price batch fetch failed:', err)
    }

    for (const sym of symbols) {
      const price = prices[sym]
      if (price == null) {
        console.error(`[marketDataService] no price for ${sym}`)
        continue
      }
      try {
        const candles = await fetchCandles(sym, '1h', 24)
        const change1h =
          candles.length >= 2
            ? ((candles[candles.length - 1]!.close - candles[candles.length - 2]!.close) /
                candles[candles.length - 2]!.close) *
              100
            : 0
        const change24h =
          candles.length >= 24
            ? ((candles[candles.length - 1]!.close - candles[0]!.close) / candles[0]!.close) * 100
            : 0

        marketData[sym] = {
          price,
          candles,
          fundingRate: 0,
          change1h,
          change24h,
          topBid: price,
          topAsk: price,
        }
      } catch (err) {
        console.error(`[marketDataService] market data error for ${sym}:`, err)
      }
    }

    return marketData
  }
}
