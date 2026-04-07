import { useQuery } from '@tanstack/react-query'

type HealthSnapshot = {
  ok: boolean
  channels?: {
    telegram?: {
      configured: boolean
      running: boolean
      lastError?: string | null
      probe?: { bot?: { username?: string } }
    }
  }
  agents?: { agentId: string; isDefault?: boolean; heartbeat?: string; sessions?: number }[]
  sessions?: { count: number; recent: { key: string; updatedAt: string; age: string }[] }
}

async function fetchHealth(): Promise<HealthSnapshot> {
  const res = await fetch('/api/openclaw/health')
  if (!res.ok) {
    throw new Error('Failed to load health')
  }
  return res.json()
}

export function SystemHealthPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['openclaw-health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  })

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span
            className={`h-2 w-2 rounded-full ${
              data?.ok ? 'bg-emerald-400' : 'bg-red-500'
            }`}
          />
          <span>{data?.ok ? 'All systems nominal' : 'Degraded'}</span>
        </div>
        {isLoading && (
          <span className="text-xs text-slate-500">Polling...</span>
        )}
        {error && (
          <span className="text-xs text-red-400">
            {(error as Error).message}
          </span>
        )}
      </div>
      {data && (
        <div className="mt-4 grid gap-4 md:grid-cols-3 text-xs text-slate-300">
          <div>
            <div className="text-slate-400">Telegram</div>
            <div className="mt-1">
              {data.channels?.telegram?.configured ? 'Configured' : 'Missing'}
            </div>
            <div className="mt-1">
              {data.channels?.telegram?.running ? 'Running' : 'Stopped'}
            </div>
            {data.channels?.telegram?.probe?.bot?.username && (
              <div className="mt-1 text-slate-400">
                @{data.channels.telegram.probe.bot.username}
              </div>
            )}
            {data.channels?.telegram?.lastError ? (
              <div
                className="mt-2 rounded border border-amber-900/80 bg-amber-950/40 p-2 text-[11px] leading-snug text-amber-100/90"
                title={data.channels.telegram.lastError}
              >
                <span className="font-medium text-amber-200/90">last channel error</span>
                <div className="mt-1 break-words font-mono text-amber-100/80">
                  {data.channels.telegram.lastError}
                </div>
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-slate-400">Agents</div>
            <div className="mt-1">
              {data.agents ? `${data.agents.length} configured` : '—'}
            </div>
            <ul className="mt-1 space-y-1">
              {data.agents?.slice(0, 3).map((a) => (
                <li key={a.agentId} className="truncate text-slate-300">
                  {a.agentId}
                  {a.isDefault && (
                    <span className="ml-1 rounded bg-emerald-500/10 px-1 text-[10px] text-emerald-300">
                      default
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-slate-400">Sessions</div>
            <div className="mt-1">
              Active: {data.sessions?.count ?? 0}
            </div>
            <ul className="mt-1 space-y-1">
              {data.sessions?.recent.slice(0, 3).map((s) => (
                <li key={s.key} className="truncate">
                  <span className="text-slate-200">{s.key}</span>
                  <span className="ml-1 text-slate-500">({s.age})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

