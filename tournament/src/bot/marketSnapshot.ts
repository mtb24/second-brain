/**
 * Build shared market data for pre-round signals (same shape as BotRunner ticks).
 * Uses one MockAdapter so bid/ask are consistent for all strategies in a snapshot.
 */

import { MockAdapter } from '../exchange/mock.js'
import { fetchPrices, fetchCandles } from '../exchange/prices.js'
import type { DecisionContext } from './decision.js'

export async function buildSharedMarketData(
  symbols: string[],
  adapter: MockAdapter,
): Promise<DecisionContext['marketData']> {
  const marketData: DecisionContext['marketData'] = {}
  let prices: Record<string, number> = {}
  try {
    prices = await fetchPrices(symbols)
  } catch (err) {
    console.error('[marketSnapshot] price batch fetch failed:', err)
  }

  for (const sym of symbols) {
    const price = prices[sym]
    if (price == null) {
      console.error(`[marketSnapshot] no price for ${sym}`)
      continue
    }
    try {
      const [candles, book, fundingRate] = await Promise.all([
        fetchCandles(sym, '1h', 24),
        adapter.getOrderBook(sym),
        adapter.getFundingRate(sym),
      ])
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
        fundingRate,
        change1h,
        change24h,
        topBid: book.bids[0]?.[0] ?? price,
        topAsk: book.asks[0]?.[0] ?? price,
      }
    } catch (err) {
      console.error(`[marketSnapshot] market data error for ${sym}:`, err)
    }
  }

  return marketData
}
