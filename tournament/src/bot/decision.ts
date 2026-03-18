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

function formatCandles(candles: Candle[]): string {
  return candles.slice(-5).map((c) =>
    `  ${new Date(c.timestamp).toISOString().slice(11, 16)} O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)}`
  ).join('\n')
}

function buildPrompt(ctx: DecisionContext): string {
  const posStr = ctx.positions.length > 0
    ? JSON.stringify(ctx.positions.map((p) => ({
        symbol: p.symbol, side: p.side, size: p.size,
        entry: p.entryPrice, pnl: p.unrealisedPnl.toFixed(2),
      })))
    : 'none'

  const marketStr = Object.entries(ctx.marketData).map(([sym, d]) =>
    `${sym}: $${d.price.toFixed(2)} | 1h: ${d.change1h.toFixed(2)}% | 24h: ${d.change24h.toFixed(2)}%\n` +
    `  bid: ${d.topBid.toFixed(2)} ask: ${d.topAsk.toFixed(2)}\n` +
    `  Last 5 candles (1h):\n${formatCandles(d.candles)}`
  ).join('\n\n')

  return `You are an autonomous crypto trading bot.

Your strategy:
---
${ctx.strategy.doc}
---

Current state:
- Balance: $${ctx.balance.toFixed(2)} USD
- Open positions: ${posStr}
- Round time remaining: ${ctx.roundTimeRemainingSeconds}s
- P&L this round: $${ctx.pnlSoFar.toFixed(2)}

Market data:
${marketStr}

Respond with a single JSON object only. No markdown, no explanation, no preamble.
If your JSON is malformed, the bot defaults to hold.

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

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

export async function makeDecision(
  ctx: DecisionContext,
  botName: string
): Promise<TradingDecision> {
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
      console.warn(`[BOT:${botName}] non-JSON response — defaulting to HOLD. Got: "${cleaned.slice(0, 80)}${cleaned.length > 80 ? '…' : ''}"`)
      return HOLD
    }

    const { action, symbol, size, leverage, confidence } = decision
    console.log(
      `[BOT:${botName}] ${action.toUpperCase()}` +
      (symbol ? ` ${symbol}` : '') +
      (size ? ` $${size}` : '') +
      (leverage ? ` ${leverage}x` : '') +
      ` conf:${confidence}`
    )
    return decision
  } catch (err) {
    console.error(`[BOT:${botName}] decision error:`, err)
    return HOLD
  }
}
