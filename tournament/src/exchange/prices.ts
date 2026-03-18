import { Candle } from './adapter.js'

const SYMBOL_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
}

const BASE = 'https://api.coingecko.com/api/v3'
const CACHE_TTL_MS = 30_000

interface CacheEntry { value: unknown; expiresAt: number }
const cache = new Map<string, CacheEntry>()

// Stores in-flight Promises so parallel calls for the same key share one request
const inflight = new Map<string, Promise<unknown>>()

function fromCache<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() < entry.expiresAt) {
    console.log(`[prices] cache hit: ${key}`)
    return entry.value as T
  }
  return null
}

function toCache(key: string, value: unknown): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

function geckoId(symbol: string): string {
  const id = SYMBOL_MAP[symbol.toUpperCase()]
  if (!id) throw new Error(`Unknown symbol: ${symbol}`)
  return id
}

async function geckoGet<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY
  }
  const url = `${BASE}${path}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

// Cache check and inflight deduplication happen before any fetch is initiated.
// A second caller arriving while the first is in-flight gets the same Promise.
async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = fromCache<T>(key)
  if (cached !== null) return cached

  if (inflight.has(key)) {
    return inflight.get(key) as Promise<T>
  }

  const promise = fetcher()
    .then((value) => {
      toCache(key, value)
      inflight.delete(key)
      return value
    })
    .catch((err) => {
      inflight.delete(key)
      throw err
    })

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
