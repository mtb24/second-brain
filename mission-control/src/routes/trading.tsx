import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BotPerf {
  botId: string
  botName: string
  strategyId: string
  strategyName: string
  tier: string
  pnl: number
  pnlPercent: number
  fitnessScore: number
  totalTrades: number
  winRate: number
}

interface Round {
  id: number
  startedAt: string
  endedAt: string | null
  status: string
  generation: number
  durationSeconds: number
  bots: BotPerf[]
  winner: BotPerf | null
}

interface LeaderboardEntry {
  id: string
  name: string
  tier: string
  status: string
  generation: number
  roundsPlayed: number
  wins: number
  avgPnlPercent: string | null
  avgFitness: string | null
  bestFitness: string | null
  totalTrades: number
  winRate: string | null
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch('/api/tournament/leaderboard')
  if (!res.ok) throw new Error('Failed to load leaderboard')
  const { leaderboard } = await res.json()
  return leaderboard
}

async function fetchRounds(): Promise<Round[]> {
  const res = await fetch('/api/tournament/rounds?limit=10')
  if (!res.ok) throw new Error('Failed to load rounds')
  const { rounds } = await res.json()
  return rounds
}

async function startRound(): Promise<unknown> {
  const res = await fetch('/api/tournament/start', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to start round')
  return res.json()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pnlColor(val: number | string | null) {
  const n = Number(val)
  if (n > 0) return 'text-emerald-400'
  if (n < 0) return 'text-red-400'
  return 'text-slate-400'
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-900/60 text-emerald-300',
    hall_of_fame: 'bg-yellow-900/60 text-yellow-300',
    retired: 'bg-slate-800 text-slate-500',
    running: 'bg-blue-900/60 text-blue-300',
    complete: 'bg-slate-800 text-slate-400',
  }
  return map[status] ?? 'bg-slate-800 text-slate-400'
}

function fmt(dt: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/trading')({
  component: TradingPage,
})

function TradingPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'leaderboard' | 'rounds'>('leaderboard')

  const leaderboardQ = useQuery({ queryKey: ['tournament-leaderboard'], queryFn: fetchLeaderboard, refetchInterval: 30_000 })
  const roundsQ = useQuery({ queryKey: ['tournament-rounds'], queryFn: fetchRounds, refetchInterval: 30_000 })

  const startMutation = useMutation({
    mutationFn: startRound,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournament-leaderboard'] })
      qc.invalidateQueries({ queryKey: ['tournament-rounds'] })
    },
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-slate-100">Tournament</h1>
        <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {startMutation.isPending ? 'Starting…' : 'Start round'}
        </button>
      </div>

      {startMutation.isError && (
        <div className="text-xs text-red-400">{(startMutation.error as Error).message}</div>
      )}
      {startMutation.isSuccess && (
        <div className="text-xs text-emerald-400">Round started — results will appear below.</div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-1 text-xs">
        {(['leaderboard', 'rounds'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? 'text-slate-100 font-medium' : 'text-slate-500 hover:text-slate-300'}
          >
            {t === 'leaderboard' ? 'Leaderboard' : 'Round history'}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      {tab === 'leaderboard' && (
        <div>
          {leaderboardQ.isLoading && <div className="text-xs text-slate-500">Loading…</div>}
          {leaderboardQ.error && <div className="text-xs text-red-400">{(leaderboardQ.error as Error).message}</div>}
          {leaderboardQ.data && leaderboardQ.data.length === 0 && (
            <div className="text-xs text-slate-500">No strategies yet. Start a round to seed them.</div>
          )}
          {leaderboardQ.data && leaderboardQ.data.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="px-3 py-2 text-left font-medium">Strategy</th>
                    <th className="px-3 py-2 text-left font-medium">Tier</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Rounds</th>
                    <th className="px-3 py-2 text-right font-medium">Wins</th>
                    <th className="px-3 py-2 text-right font-medium">Win%</th>
                    <th className="px-3 py-2 text-right font-medium">Avg PnL%</th>
                    <th className="px-3 py-2 text-right font-medium">Best fitness</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardQ.data.map((s, i) => (
                    <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-3 py-2 font-mono text-slate-100">
                        {i === 0 && <span className="mr-1 text-yellow-400">👑</span>}
                        {s.name}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{s.tier}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadge(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">{s.roundsPlayed}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{s.wins}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{s.winRate != null ? `${s.winRate}%` : '—'}</td>
                      <td className={`px-3 py-2 text-right ${pnlColor(s.avgPnlPercent)}`}>
                        {s.avgPnlPercent != null ? `${s.avgPnlPercent}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">{s.bestFitness ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Round history */}
      {tab === 'rounds' && (
        <div className="space-y-3">
          {roundsQ.isLoading && <div className="text-xs text-slate-500">Loading…</div>}
          {roundsQ.error && <div className="text-xs text-red-400">{(roundsQ.error as Error).message}</div>}
          {roundsQ.data && roundsQ.data.length === 0 && (
            <div className="text-xs text-slate-500">No rounds yet.</div>
          )}
          {roundsQ.data?.map((round) => (
            <div key={round.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-slate-100">Round #{round.id}</span>
                  <span className="text-slate-500">gen {round.generation}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadge(round.status)}`}>
                    {round.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">{fmt(round.startedAt)}</div>
              </div>
              {round.bots.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="text-left font-normal py-0.5">Strategy</th>
                      <th className="text-right font-normal py-0.5">PnL%</th>
                      <th className="text-right font-normal py-0.5">Fitness</th>
                      <th className="text-right font-normal py-0.5">Trades</th>
                      <th className="text-right font-normal py-0.5">Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {round.bots.map((b, i) => (
                      <tr key={b.botId}>
                        <td className="py-0.5 font-mono text-slate-200">
                          {i === 0 && round.status === 'complete' && <span className="mr-1 text-yellow-400">★</span>}
                          {b.strategyName}
                        </td>
                        <td className={`py-0.5 text-right ${pnlColor(b.pnlPercent)}`}>
                          {b.pnlPercent.toFixed(2)}%
                        </td>
                        <td className="py-0.5 text-right text-slate-300">{b.fitnessScore.toFixed(2)}</td>
                        <td className="py-0.5 text-right text-slate-400">{b.totalTrades}</td>
                        <td className="py-0.5 text-right text-slate-400">{(b.winRate * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {round.bots.length === 0 && (
                <div className="text-[11px] text-slate-500">No bot data recorded.</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
