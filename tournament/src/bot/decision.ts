import Anthropic from '@anthropic-ai/sdk'
import { Candle, Position } from '../exchange/adapter.js'
import { Strategy, TradingDecision } from './types.js'

const HOLD: TradingDecision = { action: 'hold', reasoning: 'parse error', confidence: 0 }

export interface DecisionContext {
  strategy: Strategy
  balance: number
  positions: Position[]
  roundTimeRemainingSeconds: number
  pnlSoFar: number
  marketData: {
    [symbol: string]: {
      price: number
      change1h: number
      change24h: number
      candles: Candle[]
      fundingRate: number
      topBid: number
      topAsk: number
    }
  }
}

export type StrategySignal = {
  strategy: string
  signal: 'enter_long' | 'enter_short' | 'hold'
  confidence: number
  reasoning: string
}

const DEFAULT_SIGNAL: StrategySignal = {
  strategy: '',
  signal: 'hold',
  confidence: 0,
  reasoning: 'parse error',
}

function formatCandles(candles: Candle[]): string {
  return candles
    .slice(-5)
    .map((c) =>
      `  ${new Date(c.timestamp).toISOString().slice(11, 16)} O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)}`,
    )
    .join('\n')
}

/** Shared strategy doc + account + market blocks for Claude prompts. */
function buildContextBody(ctx: DecisionContext): string {
  const posStr =
    ctx.positions.length > 0
      ? JSON.stringify(
          ctx.positions.map((p) => ({
            symbol: p.symbol,
            side: p.side,
            size: p.size,
            entry: p.entryPrice,
            pnl: p.unrealisedPnl.toFixed(2),
          })),
        )
      : 'none'

  const marketStr = Object.entries(ctx.marketData)
    .map(
      ([sym, d]) =>
        `${sym}: $${d.price.toFixed(2)} | 1h: ${d.change1h.toFixed(2)}% | 24h: ${d.change24h.toFixed(2)}%\n` +
        `  bid: ${d.topBid.toFixed(2)} ask: ${d.topAsk.toFixed(2)}\n` +
        `  Last 5 candles (1h):\n${formatCandles(d.candles)}`,
    )
    .join('\n\n')

  return `Your strategy:
---
${ctx.strategy.doc}
---

Current state:
- Balance: $${ctx.balance.toFixed(2)} USD
- Open positions: ${posStr}
- Round time remaining: ${ctx.roundTimeRemainingSeconds}s
- P&L this round: $${ctx.pnlSoFar.toFixed(2)}

Market data:
${marketStr}`
}

function buildPrompt(ctx: DecisionContext): string {
  return `You are an autonomous crypto trading bot.

${buildContextBody(ctx)}

Respond with a single JSON object only. No markdown, no explanation, no preamble.
If your JSON is malformed, the bot defaults to hold.
Treat the strategy rules as hard constraints:
- If the entry condition in the strategy matches and there is no open position, return buy/sell (NOT hold).
- If the exit condition matches with an open position, return close (NOT hold).
- Return hold only when neither entry nor exit condition matches.

{"action":"buy"|"sell"|"close"|"hold","symbol":"BTC","size":200,"leverage":3,"orderType":"market","limitPrice":null,"reasoning":"one sentence max","confidence":0.75}

Rules:
- Omit symbol, size, leverage, orderType if action is "hold"
- Omit symbol, size, leverage, orderType if action is "close" (closes all)
- size is USD notional (not coin amount)
- leverage must be between 1 and 50
- confidence is 0.0 to 1.0
- reasoning must be one sentence, max 20 words

Respond with valid JSON only. No preamble, no explanation, no markdown code blocks. The first character of your response must be {`
}

function buildSignalPrompt(ctx: DecisionContext): string {
  return `You are evaluating whether this strategy would enter a NEW position right now. Do not execute any trade. Just signal.

${buildContextBody(ctx)}

Based only on the strategy rules and the current state above:
- If the strategy would open a new long (buy) now, signal enter_long.
- If the strategy would open a new short (sell) now, signal enter_short.
- If it would only hold, close an existing position, or not enter, signal hold.

Respond with a single JSON object only. No markdown, no explanation, no preamble.
If your JSON is malformed, the signal defaults to hold.

{"strategy":"${ctx.strategy.name}","signal":"enter_long"|"enter_short"|"hold","confidence":0.75,"reasoning":"one sentence max"}

Rules:
- strategy must be exactly "${ctx.strategy.name}"
- confidence is 0.0 to 1.0
- reasoning must be one sentence, max 20 words

Respond with valid JSON only. No preamble, no explanation, no markdown code blocks. The first character of your response must be {`
}

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

function normalizeSignal(raw: unknown, strategyName: string): StrategySignal {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SIGNAL, strategy: strategyName }
  const o = raw as Record<string, unknown>
  const strategy =
    typeof o.strategy === 'string' && o.strategy.trim() ? o.strategy.trim() : strategyName
  let signal: StrategySignal['signal'] = 'hold'
  const s = typeof o.signal === 'string' ? o.signal.toLowerCase().replace(/-/g, '_') : ''
  if (s === 'enter_long' || s === 'long' || s === 'buy') signal = 'enter_long'
  else if (s === 'enter_short' || s === 'short' || s === 'sell') signal = 'enter_short'
  else if (s === 'hold') signal = 'hold'
  const confidence =
    typeof o.confidence === 'number' && Number.isFinite(o.confidence)
      ? Math.max(0, Math.min(1, o.confidence))
      : 0
  const reasoning =
    typeof o.reasoning === 'string' && o.reasoning.trim()
      ? o.reasoning.trim().slice(0, 200)
      : 'No reasoning provided'
  return { strategy, signal, confidence, reasoning }
}

/**
 * Dry-run: same model/context as makeDecision, but only returns entry signal (no execution).
 */
export async function getStrategySignal(
  ctx: DecisionContext,
  botName: string,
): Promise<StrategySignal> {
  try {
    const msg = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      temperature: 0,
      messages: [{ role: 'user', content: buildSignalPrompt(ctx) }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const cleaned = text.replace(/```json|```/g, '').trim()

    try {
      const parsed = JSON.parse(cleaned) as unknown
      const sig = normalizeSignal(parsed, ctx.strategy.name)
      console.log(
        `[SIGNAL:${botName}] ${sig.signal} conf:${sig.confidence.toFixed(2)} — ${sig.reasoning.slice(0, 60)}${sig.reasoning.length > 60 ? '…' : ''}`,
      )
      return sig
    } catch {
      console.warn(
        `[SIGNAL:${botName}] non-JSON response — defaulting to hold. Got: "${cleaned.slice(0, 80)}${cleaned.length > 80 ? '…' : ''}"`,
      )
      return { ...DEFAULT_SIGNAL, strategy: ctx.strategy.name, reasoning: 'parse error' }
    }
  } catch (err) {
    console.error(`[SIGNAL:${botName}] signal error:`, err)
    return { ...DEFAULT_SIGNAL, strategy: ctx.strategy.name, reasoning: 'API error' }
  }
}

export async function makeDecision(ctx: DecisionContext, botName: string): Promise<TradingDecision> {
  try {
    const msg = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      temperature: 0,
      messages: [{ role: 'user', content: buildPrompt(ctx) }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const cleaned = text.replace(/```json|```/g, '').trim()

    let decision: TradingDecision
    try {
      decision = JSON.parse(cleaned) as TradingDecision
    } catch {
      console.warn(
        `[BOT:${botName}] non-JSON response — defaulting to HOLD. Got: "${cleaned.slice(0, 80)}${cleaned.length > 80 ? '…' : ''}"`,
      )
      return HOLD
    }

    const { action, symbol, size, leverage, confidence } = decision
    console.log(
      `[BOT:${botName}] ${action.toUpperCase()}` +
        (symbol ? ` ${symbol}` : '') +
        (size ? ` $${size}` : '') +
        (leverage ? ` ${leverage}x` : '') +
        ` conf:${confidence}`,
    )
    return decision
  } catch (err) {
    console.error(`[BOT:${botName}] decision error:`, err)
    return HOLD
  }
}
