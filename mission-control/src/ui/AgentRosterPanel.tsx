import { useQuery } from '@tanstack/react-query'

type AgentSummary = {
  agentId: string
  isDefault?: boolean
  heartbeat?: { enabled?: boolean; every?: string }
  sessions?: number | { count?: number }
  messageCount?: number
}

async function fetchAgents(): Promise<AgentSummary[]> {
  const res = await fetch('/api/openclaw/agents')
  if (!res.ok) {
    throw new Error('Failed to load agents')
  }
  return res.json()
}

export function AgentRosterPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['openclaw-agents'],
    queryFn: fetchAgents,
    refetchInterval: 60_000,
  })

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">Agent roster</h3>
        {isLoading && (
          <span className="text-xs text-slate-500">Refreshing…</span>
        )}
      </div>
      {error && (
        <div className="mt-2 text-xs text-red-400">
          {(error as Error).message}
        </div>
      )}
      <ul className="mt-3 space-y-2 text-xs text-slate-200">
        {data?.map((a) => (
          <li
            key={a.agentId}
            className="flex items-center justify-between rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-slate-100">{a.agentId}</div>
              <div className="text-[11px] text-slate-500">
                Sessions: {a.messageCount ?? (typeof a.sessions === 'object' && a.sessions != null ? a.sessions.count : a.sessions) ?? 0}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {a.isDefault && (
                <span className="rounded bg-emerald-500/10 px-1 text-[10px] font-medium text-emerald-300">
                  default
                </span>
              )}
              <span className="text-[10px] text-slate-500">
                {a.heartbeat?.every ?? 'disabled'}
              </span>
            </div>
          </li>
        )) ?? (
          <li className="text-xs text-slate-500">No agents available.</li>
        )}
      </ul>
    </div>
  )
}

