import { TradingDecision, Bot } from '../bot/types.js'

interface LogDecisionPayload {
  decision: TradingDecision
  bot: Bot
  strategyName: string
  balance: number
  pnl: number
}

export async function logDecisionToOB1(p: LogDecisionPayload): Promise<void> {
  const url = process.env.INGEST_URL
  const token = process.env.INGEST_TOKEN
  if (!url || !token) {
    console.warn('[ingest] INGEST_URL or INGEST_TOKEN not set — skipping OB1 log')
    return
  }

  const { decision: d, bot, strategyName, balance, pnl } = p
  const content =
    `Bot ${bot.name} (${strategyName}): ${d.action.toUpperCase()}` +
    (d.symbol ? ` ${d.symbol}` : '') +
    (d.size ? ` $${d.size}` : '') +
    (d.leverage ? ` ${d.leverage}x` : '') +
    `. ${d.reasoning} Confidence: ${d.confidence}. Balance: $${balance.toFixed(2)}. P&L: $${pnl.toFixed(2)}.`

  const body = {
    type: 'text',
    content,
    source: 'tournament',
    metadata: {
      project_tag: 'tournament',
      domain_tag: 'trading_research',
      bot_id: bot.id,
      round_id: bot.roundId,
      strategy_id: bot.strategyId,
      action: d.action,
      symbol: d.symbol ?? null,
      confidence: d.confidence,
    },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.warn(`[ingest] OB1 log failed: ${res.status}`)
    }
  } catch (err) {
    console.warn('[ingest] OB1 log error:', err)
  }
}
