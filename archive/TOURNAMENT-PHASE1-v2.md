# Trading Tournament System — Phase 1 Spec (v2)
# Location: /Users/kendowney/Sites/SecondBrain/tournament/

## Overview

Build the foundation of an autonomous crypto trading tournament system.
The system is exchange-agnostic by design. All trading logic runs against
an ExchangeAdapter interface. Phase 1 ships a MockAdapter that uses real
live market data from CoinGecko but simulates order execution in memory.

When the system is ready for live trading, a real exchange adapter is
dropped in — no changes to the tournament engine required.

Phase 1 delivers:
- ExchangeAdapter interface + MockAdapter with real price data
- Strategy document format (Markdown)
- 3 hand-written seed strategies
- Decision engine (Claude API → trading decision)
- Single bot runner (fetch market data → decide → simulate trade → log)
- OB1 integration for decision logging
- SQL schema for tournament data
- Entry point test harness (run one bot for 10 minutes, DRY_RUN safe)

---

## Non-Goals for Phase 1

- No tournament orchestration (Phase 2)
- No genetic breeding (Phase 3)
- No Mission Control UI changes (Phase 4)
- No Strategy Master agent (Phase 4)
- No real money or live exchange connections
- No wallet management

---

## Repository Structure

```
/Users/kendowney/Sites/SecondBrain/tournament/
├── src/
│   ├── exchange/
│   │   ├── adapter.ts         # ExchangeAdapter interface + shared types
│   │   ├── mock.ts            # MockAdapter — real prices, simulated orders
│   │   └── prices.ts          # CoinGecko price/candle fetcher
│   ├── bot/
│   │   ├── runner.ts          # Bot execution loop
│   │   ├── decision.ts        # Claude API → TradingDecision
│   │   └── types.ts           # Bot, Strategy, Decision, Performance types
│   ├── strategies/
│   │   ├── seed/
│   │   │   ├── momentum.md
│   │   │   ├── mean-revert.md
│   │   │   └── breakout.md
│   │   └── loader.ts          # Load strategy docs from disk
│   ├── db/
│   │   └── tournament.ts      # OB1 + Postgres read/write
│   └── index.ts               # Entry point — single bot test harness
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Environment Variables

```env
# Claude API — required for bot decision-making
# Get from console.anthropic.com — billed per token, separate from OAuth
ANTHROPIC_API_KEY=

# Second brain DB — same Postgres instance as rest of brain stack
DB_URL=postgresql://brain:brain@localhost:5432/brain

# Second brain ingest API — for logging decisions to OB1
INGEST_URL=http://127.0.0.1:8000
INGEST_TOKEN=

# Safety flag — MUST be true in Phase 1
# When true: decisions are logged but no real orders are placed
# When false: live exchange adapter will execute real trades (Phase 5+)
DRY_RUN=true

# CoinGecko API (optional — free tier works without key, key increases rate limit)
COINGECKO_API_KEY=
```

---

## 1. Exchange Adapter Interface (`src/exchange/adapter.ts`)

This is the contract every exchange adapter must implement.
The tournament engine only ever talks to this interface — never to
a specific exchange SDK.

```typescript
export interface Candle {
  timestamp: number   // unix ms
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface OrderBook {
  bids: [number, number][]   // [price, size] sorted descending
  asks: [number, number][]   // [price, size] sorted ascending
}

export interface Position {
  symbol: string
  side: 'long' | 'short'
  size: number               // in USD notional
  entryPrice: number
  markPrice: number
  unrealisedPnl: number
  leverage: number
}

export interface OrderRequest {
  symbol: string
  side: 'buy' | 'sell'
  size: number               // USD notional
  leverage: number           // 1x minimum
  orderType: 'market' | 'limit'
  limitPrice?: number
}

export interface OrderResult {
  orderId: string
  status: 'ok' | 'error'
  fillPrice?: number
  message?: string
}

export interface PnL {
  realised: number
  unrealised: number
  total: number
  startingBalance: number
  currentBalance: number
}

export interface ExchangeAdapter {
  // Identity
  readonly name: string      // e.g. 'mock', 'coinbase', 'kraken'
  readonly isLive: boolean   // true = real money at risk

  // Market data
  getPrice(symbol: string): Promise<number>
  getCandles(symbol: string, interval: '1m'|'5m'|'15m'|'1h'|'4h'|'1d', count: number): Promise<Candle[]>
  getOrderBook(symbol: string): Promise<OrderBook>
  getFundingRate(symbol: string): Promise<number>   // 0 if not applicable

  // Account state
  getBalance(): Promise<number>         // USDC/USD available
  getPositions(): Promise<Position[]>   // open positions
  getOpenOrders(): Promise<any[]>

  // Trading — MUST check DRY_RUN before executing
  placeOrder(order: OrderRequest): Promise<OrderResult>
  closePosition(symbol: string): Promise<OrderResult>
  cancelAllOrders(): Promise<void>

  // Performance
  getPnL(): Promise<PnL>

  // Lifecycle
  initialize(startingBalance: number): Promise<void>
  reset(): Promise<void>   // clear positions, restore starting balance
}
```

---

## 2. CoinGecko Price Fetcher (`src/exchange/prices.ts`)

Fetch real market data. Used by the MockAdapter.

```typescript
// Supported symbols map to CoinGecko IDs
const SYMBOL_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
}

// Fetch current price
export async function fetchPrice(symbol: string): Promise<number>

// Fetch OHLCV candles
// CoinGecko free tier provides daily candles via /coins/{id}/ohlc
// For intervals finer than 1d: synthesize from recent price history
export async function fetchCandles(
  symbol: string,
  interval: string,
  count: number
): Promise<Candle[]>

// Fetch top N symbols by market cap (used by strategies that want to scan)
export async function fetchTopSymbols(n: number): Promise<string[]>
```

### Notes:
- Always wrap in try/catch — CoinGecko rate limits free tier at ~30 req/min
- Cache prices for 30 seconds to avoid hammering the API during a decision loop
- Log cache hits vs fetches to console for debugging

---

## 3. Mock Adapter (`src/exchange/mock.ts`)

Simulates a trading account using real market data.

### State (in memory, not persisted):
```typescript
interface MockState {
  balance: number
  positions: Map<string, Position>
  orders: OrderResult[]
  startingBalance: number
  realisedPnl: number
}
```

### Order simulation rules:
- Market orders fill immediately at current CoinGecko price + 0.05% slippage
- Position size in USD: `size` from OrderRequest
- Leverage is tracked but does not increase actual balance exposure in mock
  (keep it simple — no liquidation engine in Phase 1)
- Closing a position: realised PnL = (exitPrice - entryPrice) / entryPrice * size
  (for long) or inverse for short
- Balance updates on close: `balance += realisedPnl`

### DRY_RUN enforcement:
```typescript
async placeOrder(order: OrderRequest): Promise<OrderResult> {
  if (process.env.DRY_RUN === 'true') {
    // Log the decision but do NOT update state
    console.log(`[DRY_RUN] Would place: ${JSON.stringify(order)}`)
    return { orderId: 'dry-run', status: 'ok', fillPrice: await this.getPrice(order.symbol) }
  }
  // ... actual mock simulation
}
```

### isLive: false — always. MockAdapter never touches real money.

---

## 4. Bot Types (`src/bot/types.ts`)

```typescript
export interface Strategy {
  id: string
  name: string
  generation: number
  tier: 'conservative' | 'balanced' | 'aggressive'
  status: 'proposed' | 'approved' | 'active' | 'retired' | 'hall_of_fame'
  source: 'manual' | 'master' | 'bred' | 'mutated'
  parentIds: string[]
  doc: string             // full markdown strategy document
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
  symbol?: string           // e.g. 'BTC', 'ETH'
  size?: number             // USD notional, omit if hold/close
  leverage?: number         // 1-50, omit if hold/close
  orderType?: 'market' | 'limit'
  limitPrice?: number
  reasoning: string         // one sentence — logged to OB1
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
  fitnessScore: number      // composite — calculated by evaluator in Phase 2
}
```

---

## 5. Strategy Document Format

Each strategy is a Markdown file in `src/strategies/seed/`.
This exact format is injected into every Claude decision call.
Keep each file under 600 tokens.

```markdown
# [Strategy Name]

## Tier
conservative | balanced | aggressive

## Core thesis
One paragraph. What market condition does this strategy exploit?
What edge does it have? When does it fail?

## Instruments
Which symbols to trade and why. Example: BTC and ETH only — highest
liquidity and most reliable technical signals.

## Entry rules
Numbered conditions that must ALL be met before entering.
Be specific. Reference price action, volume, momentum.

## Exit rules
- Take profit: specific condition or % gain
- Stop loss: specific condition or % loss
- Time stop: maximum hold duration

## Position sizing
- Base size: % of balance per trade
- Maximum: never exceed X% of balance in one position
- Leverage: X to Yx depending on conviction

## Personality
One sentence. The bot's decision-making character.
Example: "Waits patiently for high-conviction setups, cuts losses fast,
never averages down."
```

---

## 6. Seed Strategies

Write exactly these three files in `src/strategies/seed/`:

### `momentum.md`
- **Tier:** balanced
- **Instruments:** BTC, ETH
- **Core thesis:** Ride strong directional price momentum. Enter when
  price breaks above recent resistance with volume confirmation.
  Exit when momentum stalls.
- **Entry:** Price breaks 4h high with above-average volume AND RSI 50-70
  (momentum but not overbought)
- **Take profit:** 3% gain
- **Stop loss:** 1.5% below entry
- **Time stop:** Close if no 1% gain after 2 hours
- **Max leverage:** 5x
- **Base size:** 25% of balance
- **Personality:** "Disciplined trend follower — only rides confirmed
  moves, never chases, always respects the stop."

### `mean-revert.md`
- **Tier:** conservative
- **Instruments:** BTC, ETH
- **Core thesis:** Prices overextend and snap back. Trade the mean
  reversion after extreme moves in either direction.
- **Entry:** Price down 3%+ in 1 hour AND RSI below 28 (oversold)
  OR price up 3%+ in 1 hour AND RSI above 72 (overbought)
- **Take profit:** 50% retracement of the move
- **Stop loss:** 2% beyond the extreme
- **Time stop:** Close if no reversion within 90 minutes
- **Max leverage:** 2x
- **Base size:** 20% of balance
- **Personality:** "Patient contrarian — waits for genuine extremes,
  never fights a clear trend, takes small profits consistently."

### `breakout.md`
- **Tier:** aggressive
- **Instruments:** BTC, ETH, SOL
- **Core thesis:** Periods of consolidation precede large directional
  moves. Identify compression and trade the breakout.
- **Entry:** Price in tight range for 4+ hours (less than 1% high-low)
  then breaks out with 3x average volume
- **Take profit:** 5% gain
- **Stop loss:** Re-entry into the range = immediate close
- **Time stop:** Close if no 2% move within 1 hour of entry
- **Max leverage:** 10x
- **Base size:** 30% of balance
- **Personality:** "Explosive and decisive — commits fully to breakouts,
  exits immediately if the thesis is invalidated."

---

## 7. Decision Engine (`src/bot/decision.ts`)

The Claude API call that converts market context + strategy into a trade.

### DecisionContext assembled before each call:

```typescript
interface DecisionContext {
  strategy: Strategy
  balance: number
  positions: Position[]
  roundTimeRemainingSeconds: number
  pnlSoFar: number
  marketData: {
    [symbol: string]: {
      price: number
      change1h: number        // % price change last hour
      change24h: number       // % price change last 24h
      candles: Candle[]       // last 24 x 1h candles
      fundingRate: number
      topBid: number
      topAsk: number
    }
  }
}
```

### System prompt:

```
You are an autonomous crypto trading bot.

Your strategy:
---
{strategy.doc}
---

Current state:
- Balance: ${balance} USD
- Open positions: {JSON.stringify(positions) or 'none'}
- Round time remaining: {roundTimeRemainingSeconds}s
- P&L this round: ${pnlSoFar}

Market data:
{for each symbol: price, 1h change, 24h change, last 5 candles summarised}

Respond with a single JSON object only. No markdown, no explanation, no
preamble. If your JSON is malformed, the bot defaults to hold.

{
  "action": "buy" | "sell" | "close" | "hold",
  "symbol": "BTC",
  "size": 200,
  "leverage": 3,
  "orderType": "market",
  "limitPrice": null,
  "reasoning": "one sentence max",
  "confidence": 0.75
}

Rules:
- Omit symbol, size, leverage, orderType if action is "hold"
- Omit symbol, size, leverage, orderType if action is "close" (closes all)
- size is USD notional (not coin amount)
- leverage must be between 1 and 50
- confidence is 0.0 to 1.0
- reasoning must be one sentence, max 20 words
```

### Implementation notes:
- Model: `claude-sonnet-4-6`
- max_tokens: 300
- temperature: 0 (deterministic decisions)
- Parse response: `JSON.parse(text.trim())`
- On any parse error or exception: return `{ action: 'hold', reasoning: 'parse error', confidence: 0 }`
- Never let decision errors crash the bot — wrap everything in try/catch
- Log every decision to console: `[BOT:name] action symbol size leverage confidence`

---

## 8. Bot Runner (`src/bot/runner.ts`)

The execution loop for a single bot.

```typescript
interface RunnerOptions {
  decisionIntervalSeconds: number   // default: 60
  roundDurationSeconds: number      // default: 600 (10 min for Phase 1 testing)
  symbols: string[]                 // default: ['BTC', 'ETH']
  verbose: boolean                  // default: true
}

class BotRunner {
  constructor(
    private bot: Bot,
    private strategy: Strategy,
    private adapter: ExchangeAdapter,
    private options: RunnerOptions
  ) {}

  async start(): Promise<BotPerformance>
  async stop(): Promise<void>
}
```

### Execution loop:

```
1. adapter.initialize(bot.startingBalance)
2. record startTime

every decisionIntervalSeconds:
  a. fetch balance, positions, open orders from adapter
  b. fetch market data for all symbols from prices.ts
  c. build DecisionContext
  d. call decision engine → TradingDecision
  e. if action !== 'hold':
       if DRY_RUN=true: log only, skip adapter call
       else: call adapter.placeOrder() or adapter.closePosition()
  f. log decision to console
  g. save decision to OB1 via ingest API
  h. check if roundDurationSeconds exceeded:
       if yes: close all positions, record performance, return

3. on stop/completion:
  a. adapter.closePosition for all open positions
  b. fetch final PnL from adapter
  c. calculate BotPerformance metrics
  d. save BotPerformance to Postgres tournament_bots table
  e. return BotPerformance
```

### OB1 log payload (POST to ingest API after each decision):

```json
{
  "type": "text",
  "content": "Bot [name] ([strategy name]): [action] [symbol] $[size] [leverage]x. [reasoning] Confidence: [confidence]. Balance: $[balance]. P&L: $[pnl].",
  "source": "tournament",
  "metadata": {
    "project_tag": "tournament",
    "domain_tag": "trading_research",
    "bot_id": "...",
    "round_id": "...",
    "strategy_id": "...",
    "action": "...",
    "symbol": "...",
    "confidence": 0.0
  }
}
```

---

## 9. Database (`src/db/tournament.ts`)

Uses the existing brain Postgres instance. Add these tables.

### Migration SQL (run once — add to a new file `db/migrations/001_tournament.sql`):

```sql
CREATE TABLE IF NOT EXISTS tournament_strategies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  generation    INTEGER NOT NULL DEFAULT 0,
  tier          TEXT NOT NULL CHECK (tier IN ('conservative', 'balanced', 'aggressive')),
  status        TEXT NOT NULL DEFAULT 'approved'
                  CHECK (status IN ('proposed','approved','active','retired','hall_of_fame')),
  source        TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual','master','bred','mutated')),
  parent_ids    UUID[] NOT NULL DEFAULT '{}',
  doc           TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_rounds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation        INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','running','complete','aborted')),
  duration_seconds  INTEGER NOT NULL DEFAULT 10800,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_bots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  round_id          UUID REFERENCES tournament_rounds(id),
  strategy_id       UUID REFERENCES tournament_strategies(id),
  status            TEXT NOT NULL DEFAULT 'idle'
                      CHECK (status IN ('idle','running','finished','error')),
  starting_balance  NUMERIC(12,2) NOT NULL DEFAULT 1000.00,
  final_balance     NUMERIC(12,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_performance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id          UUID NOT NULL REFERENCES tournament_bots(id),
  round_id        UUID NOT NULL REFERENCES tournament_rounds(id),
  strategy_id     UUID NOT NULL REFERENCES tournament_strategies(id),
  pnl             NUMERIC(12,2),
  pnl_percent     NUMERIC(8,4),
  max_drawdown    NUMERIC(8,4),
  total_trades    INTEGER NOT NULL DEFAULT 0,
  winning_trades  INTEGER NOT NULL DEFAULT 0,
  win_rate        NUMERIC(5,4),
  sharpe_ratio    NUMERIC(8,4),
  fitness_score   NUMERIC(8,4),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### TypeScript functions to implement:

```typescript
// Strategies
export async function insertStrategy(s: Omit<Strategy, 'id' | 'createdAt'>): Promise<Strategy>
export async function getStrategiesByStatus(status: string): Promise<Strategy[]>
export async function updateStrategyStatus(id: string, status: string): Promise<void>

// Rounds
export async function createRound(generation: number, durationSeconds: number): Promise<string>
export async function updateRoundStatus(id: string, status: string): Promise<void>

// Bots
export async function createBot(bot: Omit<Bot, 'id'>): Promise<string>
export async function updateBotStatus(id: string, status: string, finalBalance?: number): Promise<void>

// Performance
export async function savePerformance(perf: BotPerformance): Promise<void>
export async function getRoundPerformance(roundId: string): Promise<BotPerformance[]>
```

---

## 10. Strategy Loader (`src/strategies/loader.ts`)

```typescript
// Load a strategy doc from disk by filename
export async function loadStrategyFromFile(filename: string): Promise<Strategy>

// Load all seed strategies from src/strategies/seed/
export async function loadSeedStrategies(): Promise<Strategy[]>
```

Strategy id for disk-loaded strategies: use the filename without extension.
Generation: 0. Source: 'manual'. Status: 'approved'.

---

## 11. Entry Point (`src/index.ts`)

Test harness — runs one bot for 10 minutes on MockAdapter.
Prints a performance summary at the end.

```typescript
async function main() {
  // 1. Load the momentum seed strategy from disk
  // 2. Create a MockAdapter with $1000 starting balance
  // 3. Create a BotRunner:
  //    - decisionIntervalSeconds: 30  (2x per minute for testing)
  //    - roundDurationSeconds: 600    (10 minutes)
  //    - symbols: ['BTC', 'ETH']
  //    - verbose: true
  // 4. Run the bot
  // 5. Print performance summary:
  //    Starting balance | Final balance | P&L | P&L% | Trades | Win rate
  // 6. Exit cleanly

  console.log('Tournament Phase 1 — Single Bot Test')
  console.log('DRY_RUN:', process.env.DRY_RUN)
  console.log('Starting...\n')

  // ... implementation
}

main().catch(console.error)
```

---

## 12. Package Setup

```json
{
  "name": "brain-tournament",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "build": "tsc",
    "migrate": "tsx src/db/migrate.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0",
    "pg": "^8.11.0",
    "dotenv": "^16.0.0",
    "node-fetch": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0",
    "@types/pg": "^8.10.0"
  }
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 13. .env.example

```env
ANTHROPIC_API_KEY=sk-ant-...
DB_URL=postgresql://brain:brain@localhost:5432/brain
INGEST_URL=http://127.0.0.1:8000
INGEST_TOKEN=
DRY_RUN=true
COINGECKO_API_KEY=
```

---

## Implementation Order for Cursor

Build in this exact order to avoid import errors:

1. `package.json` + `tsconfig.json` → `npm install`
2. `src/exchange/adapter.ts` — interface and types only, no implementation
3. `src/exchange/prices.ts` — CoinGecko fetcher with 30s cache
4. `src/exchange/mock.ts` — MockAdapter implementing ExchangeAdapter
5. `src/bot/types.ts` — Strategy, Bot, TradingDecision, BotPerformance
6. `src/strategies/loader.ts` — load from disk
7. `src/strategies/seed/momentum.md`
8. `src/strategies/seed/mean-revert.md`
9. `src/strategies/seed/breakout.md`
10. `src/bot/decision.ts` — Claude API call
11. `src/db/tournament.ts` — Postgres functions
12. `db/migrations/001_tournament.sql` — SQL schema
13. `src/bot/runner.ts` — execution loop
14. `src/index.ts` — test harness
15. `.env.example`

---

## Hard Requirements (non-negotiable)

1. **DRY_RUN=true must skip ALL order state changes** in MockAdapter.
   Log the would-be action to console but do not mutate balance or positions.

2. **Every external call (CoinGecko, Claude API, Postgres, ingest API)
   must be wrapped in try/catch.** Errors must log and either retry or
   return a safe default. Nothing should crash the bot runner.

3. **No exchange-specific SDK anywhere in this codebase.** The only
   exchange-related code is in `src/exchange/`. Everything else talks
   to ExchangeAdapter only.

4. **Keep files under 200 lines.** Split early. No God files.

5. **Strategy docs are plain Markdown.** No JSON, no YAML, no code.
   They must be human-readable and human-editable.

6. **The MockAdapter `isLive` property must always return `false`.**
   Any future live adapter must have `isLive: true`. The bot runner
   logs a warning and requires explicit confirmation if `isLive: true`.

---

## Phase 1 Done When

Running `npm start` with `DRY_RUN=true` produces console output like:

```
Tournament Phase 1 — Single Bot Test
DRY_RUN: true
Starting...

[00:00] BTC: $84,231 | ETH: $3,412
[00:30] BOT:momentum HOLD — waiting for momentum confirmation. Confidence: 0.42
[01:00] BTC: $84,180 | ETH: $3,408
[01:30] BOT:momentum BUY BTC $250 3x market — RSI crossing 50 with volume surge. Confidence: 0.71
[DRY_RUN] Would place: {"symbol":"BTC","side":"buy","size":250,"leverage":3,"orderType":"market"}
...

=== PERFORMANCE SUMMARY ===
Strategy:        Momentum Rider
Starting balance: $1,000.00
Final balance:    $1,000.00  (DRY_RUN — no state changes)
Decisions made:  20
Actions taken:   7 (dry run — not executed)
Hold decisions:  13
Round duration:  10m 0s
===========================
```
