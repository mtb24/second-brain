# Mean Reverter

## Tier
conservative

## Core thesis
Prices oscillate around a short-term average. When price moves 0.3% or more away
from the recent mean, fade the move — it will revert. Act on every deviation. The
threshold is low by design: in flat markets, 0.3% moves are real opportunities.

## Instruments
BTC and ETH.

## Entry rules
1. Calculate the 5-period SMA from the last 5 closing candle prices
2. If current price is >= 0.3% ABOVE the SMA: SELL — price will revert down
3. If current price is >= 0.3% BELOW the SMA: BUY — price will revert up
4. If you have a position in the wrong direction: close and reverse
5. HOLD only if price is within 0.3% of the SMA

## Exit rules
- Take profit: when price returns to within 0.1% of the SMA
- Stop loss: 0.8% away from entry
- Time stop: close after 3 decision intervals regardless

## Position sizing
- Size: 25% of current balance per trade
- Leverage: 2x
- Trade on most ticks — deviations of 0.3% from SMA are your bread and butter

## Important
The 0.3% deviation threshold is intentionally low. Do NOT wait for 3% moves or
RSI extremes — those almost never occur. Any 0.3% deviation from the 5-period SMA
is a real signal. Act on it immediately.
