import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

type AgentFile = {
  path: string
  size: number
}

type AgentDetail = {
  agent: {
    agentId: string
    isDefault?: boolean
    heartbeat?: { enabled?: boolean; every?: string }
    sessions?: number | { count?: number }
    messageCount?: number
  } | null
  files: AgentFile[]
  sessions: {
    key: string
    updatedAt: string
    age: string
  }[]
}

async function fetchAgentDetail(id: string): Promise<AgentDetail> {
  const res = await fetch(`/api/openclaw/agents/${encodeURIComponent(id)}`)
  if (!res.ok) {
    throw new Error('Failed to load agent detail')
  }
  return res.json()
}

export const Route = createFileRoute('/agents/$id')({
  component: AgentDetailPage,
})

function AgentDetailPage() {
  const { id } = Route.useParams()

  const { data, isLoading, error } = useQuery({
    queryKey: ['openclaw-agent-detail', id],
    queryFn: () => fetchAgentDetail(id),
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return <div className="text-xs text-slate-500">Loading agent…</div>
  }

  if (error) {
    return (
      <div className="text-xs text-red-400">
        {(error as Error).message}
      </div>
    )
  }

  if (!data?.agent) {
    return (
      <div className="text-xs text-slate-500">
        Agent not found in gateway.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            {data.agent.agentId}
          </h1>
          <div className="mt-1 text-xs text-slate-500">
            Heartbeat: {data.agent.heartbeat?.every ?? 'disabled'} · Sessions:{' '}
            {data.agent.messageCount ?? (typeof data.agent.sessions === 'object' && data.agent.sessions != null ? data.agent.sessions.count : data.agent.sessions) ?? 0}
          </div>
        </div>
        {data.agent.isDefault && (
          <span className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Default agent
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900/60">
          <header className="border-b border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300">
            Workspace files
          </header>
          <ul className="max-h-72 divide-y divide-slate-800 overflow-auto text-xs">
            {data.files.map((f) => (
              <li key={f.path} className="px-4 py-2 flex items-center justify-between gap-2">
                <span className="truncate text-slate-100">{f.path}</span>
                <span className="text-[10px] text-slate-500">
                  {(f.size / 1024).toFixed(1)} kB
                </span>
              </li>
            ))}
            {data.files.length === 0 && (
              <li className="px-4 py-3 text-xs text-slate-500">
                No workspace files reported.
              </li>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60">
          <header className="border-b border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300">
            Recent sessions
          </header>
          <ul className="max-h-72 divide-y divide-slate-800 overflow-auto text-xs">
            {data.sessions.map((s) => (
              <li key={s.key} className="px-4 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-100">{s.key}</span>
                  <span className="text-[10px] text-slate-500">
                    {s.age}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {new Date(s.updatedAt).toLocaleString()}
                </div>
              </li>
            ))}
            {data.sessions.length === 0 && (
              <li className="px-4 py-3 text-xs text-slate-500">
                No recent sessions.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}

