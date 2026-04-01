/**
 * Build shared market data for pre-round signals (same shape as coordinated bot ticks).
 * Uses one MockAdapter so bid/ask are consistent for all strategies in a snapshot.
 */

import { MockAdapter } from '../exchange/mock.js'
import { MarketDataService } from './marketDataService.js'
import type { DecisionContext } from './decision.js'

export async function buildSharedMarketData(
  symbols: string[],
  adapter: MockAdapter
): Promise<DecisionContext['marketData']> {
  const svc = new MarketDataService()
  const base = await svc.fetchSharedMarketData(symbols)

  const priceAnchors: Record<string, number> = {}
  for (const sym of Object.keys(base)) {
    priceAnchors[sym] = base[sym]!.price
  }
  adapter.setSharedTickPrices(priceAnchors)

  for (const sym of Object.keys(base)) {
    const slice = base[sym]!
    try {
      const [book, fundingRate] = await Promise.all([
        adapter.getOrderBook(sym),
        adapter.getFundingRate(sym),
      ])
      slice.topBid = book.bids[0]?.[0] ?? slice.price
      slice.topAsk = book.asks[0]?.[0] ?? slice.price
      slice.fundingRate = fundingRate
    } catch (err) {
      console.error(`[marketSnapshot] book/funding for ${sym}:`, err)
    }
  }

  adapter.clearSharedTickPrices()

  return base
}
