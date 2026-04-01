import { Candle } from './adapter.js'

const SYMBOL_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
}

const BASE = 'https://api.coingecko.com/api/v3'
// Spot / batch price: refresh at least every decision tick (~60s), shared across callers.
const PRICE_CACHE_TTL_MS = 55_000
// OHLC: 5-minute freshness — candles do not need 60s refresh.
const CANDLE_CACHE_TTL_MS = 300_000

interface CacheEntry {
  value: unknown
  expiresAt: number
}
const cache = new Map<string, CacheEntry>()

const inflight = new Map<string, Promise<unknown>>()

class CoinGecko429Error extends Error {
  constructor(message = 'CoinGecko rate limited') {
    super(message)
    this.name = 'CoinGecko429Error'
  }
}

/** Wall time before we issue another HTTP request to CoinGecko after a 429. */
let geckoBackoffUntil = 0

function cacheTtlForKey(key: string): number {
  if (key.startsWith('candles:')) return CANDLE_CACHE_TTL_MS
  return PRICE_CACHE_TTL_MS
}

function fromCache<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() < entry.expiresAt) {
    console.log(`[prices] cache hit: ${key}`)
    return entry.value as T
  }
  return null
}

function peekStale<T>(key: string): T | null {
  const entry = cache.get(key)
  return entry ? (entry.value as T) : null
}

function toCache(key: string, value: unknown): void {
  cache.set(key, { value, expiresAt: Date.now() + cacheTtlForKey(key) })
}

function geckoId(symbol: string): string {
  const id = SYMBOL_MAP[symbol.toUpperCase()]
  if (!id) throw new Error(`Unknown symbol: ${symbol}`)
  return id
}

async function geckoGet<T>(path: string): Promise<T> {
  const now = Date.now()
  if (now < geckoBackoffUntil) {
    throw new CoinGecko429Error('in backoff window')
  }

  const headers: Record<string, string> = {}
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY
  }
  const url = `${BASE}${path}`
  const res = await fetch(url, { headers })

  if (res.status === 429) {
    geckoBackoffUntil = Date.now() + 60_000
    console.warn('[prices] CoinGecko rate limited, backing off 60s')
    throw new CoinGecko429Error()
  }

  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = fromCache<T>(key)
  if (cached !== null) return cached

  if (Date.now() < geckoBackoffUntil) {
    const stale = peekStale<T>(key)
    if (stale !== null) {
      console.warn('[prices] in CoinGecko backoff window, returning stale cache')
      return stale
    }
  }

  if (inflight.has(key)) {
    return inflight.get(key) as Promise<T>
  }

  const promise = (async () => {
    try {
      const value = await fetcher()
      toCache(key, value)
      return value
    } catch (err) {
      if (err instanceof CoinGecko429Error) {
        const stale = peekStale<T>(key)
        if (stale !== null) return stale
      }
      throw err
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}

export async function fetchPrice(symbol: string): Promise<number> {
  try {
    return await fetchWithCache(`price:${symbol}`, async () => {
      const id = geckoId(symbol)
      const data = await geckoGet<Record<string, { usd: number }>>(
        `/simple/price?ids=${id}&vs_currencies=usd`
      )
      const price = data[id].usd
      console.log(`[prices] fetch ${symbol}: $${price}`)
      return price
    })
  } catch (err) {
    console.error(`[prices] fetchPrice ${symbol} failed:`, err)
    throw err
  }
}

export async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  const key = `prices:${[...symbols].sort().join(',')}`
  try {
    return await fetchWithCache(key, async () => {
      const ids = symbols.map(geckoId).join(',')
      const data = await geckoGet<Record<string, { usd: number }>>(
        `/simple/price?ids=${ids}&vs_currencies=usd`
      )
      const result: Record<string, number> = {}
      for (const sym of symbols) {
        const id = geckoId(sym)
        if (data[id]?.usd != null) {
          result[sym] = data[id].usd
          console.log(`[prices] fetch ${sym}: $${data[id]!.usd}`)
        }
      }
      return result
    })
  } catch (err) {
    console.error(`[prices] fetchPrices ${symbols.join(',')} failed:`, err)
    throw err
  }
}

export async function fetchCandles(
  symbol: string,
  interval: string,
  count: number
): Promise<Candle[]> {
  try {
    return await fetchWithCache(`candles:${symbol}:${interval}:${count}`, async () => {
      const id = geckoId(symbol)
      const days = interval === '1d' ? 7 : 1
      const raw = await geckoGet<[number, number, number, number, number][]>(
        `/coins/${id}/ohlc?vs_currency=usd&days=${days}`
      )
      const candles: Candle[] = raw.map(([ts, o, h, l, c]) => ({
        timestamp: ts,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: 0,
      }))
      console.log(`[prices] fetch candles ${symbol}: ${candles.length} points`)
      return candles.slice(-count)
    })
  } catch (err) {
    console.error(`[prices] fetchCandles ${symbol} failed:`, err)
    throw err
  }
}

export async function fetchTopSymbols(n: number): Promise<string[]> {
  try {
    return await fetchWithCache(`top:${n}`, async () => {
      const data = await geckoGet<Array<{ symbol: string }>>(
        `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${n}&page=1`
      )
      return data.map((c) => c.symbol.toUpperCase()).filter((s) => SYMBOL_MAP[s])
    })
  } catch (err) {
    console.error('[prices] fetchTopSymbols failed:', err)
    throw err
  }
}
