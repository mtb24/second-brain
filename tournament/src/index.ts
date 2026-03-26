/**
 * tournament/src/index.ts
 * Entry point — run a tournament round manually
 *
 * Usage:
 *   npm run tournament              # start a round with defaults
 *   TOURNAMENT_BOT_COUNT=5 npm run tournament
 */

import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
// Load ~/brain/.env (parent of the tournament dir) as the source of truth
loadEnv({ path: resolve(__dirname, '../../.env') })
import { TournamentOrchestrator } from './orchestrator.js'

async function main() {
  const orchestrator = new TournamentOrchestrator()

  console.log('[TOURNAMENT] Starting round...')
  const result = await orchestrator.startRound()

  console.log('\n[TOURNAMENT] Round complete.')
  console.log(`  Round ID:   ${result.roundId}`)
  console.log(`  Generation: ${result.generation}`)
  console.log(`  Duration:   ${(result.durationMs / 1000).toFixed(1)}s`)
  console.log(`  Winner:     strategy ${result.winner.strategyId} | ${result.winner.pnlPercent.toFixed(2)}% PnL`)
  console.log(`\n  Full results (ranked by fitness):`)
  for (const [i, perf] of result.performances.entries()) {
    console.log(`    ${i + 1}. ${perf.strategyId} — PnL: ${perf.pnlPercent.toFixed(2)}% | trades: ${perf.totalTrades}`)
  }
}

main().catch((err) => {
  console.error('[TOURNAMENT] Fatal error:', err)
  process.exit(1)
})
