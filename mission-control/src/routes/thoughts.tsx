import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

type Thought = {
  id: string
  created_at: string
  text: string
  domain_tag: string
  project_tag: string | null
}

async function fetchRecentThoughts(params: {
  domain_tag?: string
  project_tag?: string
}): Promise<Thought[]> {
  const url = new URL('/api/ingest/thoughts/recent', window.location.origin)
  if (params.domain_tag) url.searchParams.set('domain_tag', params.domain_tag)
  if (params.project_tag) url.searchParams.set('project_tag', params.project_tag)
  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error('Failed to load thoughts')
  }
  return res.json()
}

export const Route = createFileRoute('/thoughts')({
  component: ThoughtsPage,
})

function ThoughtsPage() {
  const [domainTag, setDomainTag] = useState<string>('')
  const [projectTag, setProjectTag] = useState<string>('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['thoughts-recent', { domainTag, projectTag }],
    queryFn: () => fetchRecentThoughts({ domain_tag: domainTag || undefined, project_tag: projectTag || undefined }),
    refetchInterval: 10_000,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400">
            Domain tag
          </label>
          <input
            className="mt-1 w-40 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            placeholder="note, code, recipe…"
            value={domainTag}
            onChange={(e) => setDomainTag(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400">
            Project tag
          </label>
          <input
            className="mt-1 w-40 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            placeholder="second_brain, client_x…"
            value={projectTag}
            onChange={(e) => setProjectTag(e.target.value)}
          />
        </div>
        {isLoading && (
          <span className="text-xs text-slate-500">Loading…</span>
        )}
        {error && (
          <span className="text-xs text-red-400">
            {(error as Error).message}
          </span>
        )}
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300">
          Live thoughts
        </div>
        <ul className="divide-y divide-slate-800 text-xs">
          {data?.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{new Date(t.created_at).toLocaleString()}</span>
                <span className="flex gap-2">
                  <span className="rounded bg-slate-800 px-1 text-[10px] uppercase tracking-wide text-slate-300">
                    {t.domain_tag}
                  </span>
                  {t.project_tag && (
                    <span className="rounded bg-slate-800 px-1 text-[10px] text-slate-400">
                      {t.project_tag}
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-slate-100">
                {t.text}
              </p>
            </li>
          )) ?? (
            <li className="px-4 py-3 text-xs text-slate-500">
              No thoughts found.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

