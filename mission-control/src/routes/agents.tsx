import { createFileRoute, Link } from '@tanstack/react-router'
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

export const Route = createFileRoute('/agents')({
  component: AgentsPage,
})

function AgentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['openclaw-agents-list'],
    queryFn: fetchAgents,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-sm font-semibold text-slate-200">Agent roster</h1>
      {isLoading && (
        <div className="text-xs text-slate-500">Loading agents…</div>
      )}
      {error && (
        <div className="text-xs text-red-400">
          {(error as Error).message}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 text-xs">
        <table className="min-w-full border-collapse">
          <thead className="bg-slate-900/80">
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 font-medium">Agent</th>
              <th className="px-3 py-2 font-medium">Default</th>
              <th className="px-3 py-2 font-medium">Sessions</th>
              <th className="px-3 py-2 font-medium">Heartbeat</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((agent) => (
              <tr
                key={agent.agentId}
                className="border-t border-slate-800/80 hover:bg-slate-800/40"
              >
                <td className="px-3 py-2">
                  <Link
                    to="/agents/$id"
                    params={{ id: agent.agentId }}
                    className="text-slate-100 hover:text-emerald-400"
                  >
                    {agent.agentId}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {agent.isDefault ? (
                    <span className="rounded bg-emerald-500/10 px-1 text-[10px] font-medium text-emerald-300">
                      default
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {agent.messageCount ?? (typeof agent.sessions === 'object' && agent.sessions != null ? agent.sessions.count : agent.sessions) ?? 0}
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {agent.heartbeat?.every ?? 'disabled'}
                </td>
              </tr>
            )) ?? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-3 text-xs text-slate-500"
                >
                  No agents available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

