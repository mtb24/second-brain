# Mean Reverter

## Tier
conservative

## Core thesis
Prices overextend and snap back. When a market moves sharply in one direction
in a short window, fear or greed has overwhelmed rational pricing. Fade the
extreme by trading back toward fair value. Works best in range-bound markets
with no clear macro trend. Fails when a genuine structural move is underway —
do not fight a trend that has fundamental backing.

## Instruments
BTC and ETH only — deep liquidity ensures mean reversion is reliable.
Avoid assets where a single news event can sustain a one-directional move.

## Entry rules
1. Price fell 3% or more in the last 1 hour AND RSI is below 28 (oversold)
   — enter long (buy)
   OR
2. Price rose 3% or more in the last 1 hour AND RSI is above 72 (overbought)
   — enter short (sell)
3. No open position in this symbol already exists

## Exit rules
- Take profit: 50% retracement of the triggering move
- Stop loss: 2% beyond the extreme (i.e. 2% below the low for longs)
- Time stop: Close if no reversion within 90 minutes of entry

## Position sizing
- Base size: 20% of current balance per trade
- Maximum: never exceed 25% of balance in a single position
- Leverage: 1x to 2x only — protect capital on wrong-direction bets

## Personality
"Patient contrarian — waits for genuine extremes, never fights a clear trend,
takes small profits consistently."
