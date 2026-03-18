import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

type SearchResult = {
  id: string
  content: string
  domain_tag?: string
  similarity: number
  metadata?: Record<string, unknown>
  created_at?: string
}

export const Route = createFileRoute('/search')({
  component: SearchPage,
})

const MAX_PREVIEW_LINES = 3

function SearchPage() {
  const [query, setQuery] = useState('')
  const [domainTag, setDomainTag] = useState('')
  const [projectTag, setProjectTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  async function runSearch(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setExpandedIds(new Set())
    try {
      const payload = {
        jsonrpc: '2.0',
        id: 'search-brain',
        method: 'tools/call',
        params: {
          name: 'search_brain',
          arguments: {
            query,
            domain_tag: domainTag || undefined,
            project_tag: projectTag || undefined,
          },
        },
      }
      const res = await fetch('/api/mcp/search-brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        throw new Error(`Search failed (${res.status})`)
      }
      const data = await res.json()
      const raw: SearchResult[] = Array.isArray(data?.result) ? data.result : []
      setResults(raw)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={runSearch}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
      >
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-medium text-slate-400">
            Query
          </label>
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your brain…"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400">
            Domain tag
          </label>
          <input
            className="mt-1 w-32 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
            value={domainTag}
            onChange={(e) => setDomainTag(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400">
            Project tag
          </label>
          <input
            className="mt-1 w-32 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
            value={projectTag}
            onChange={(e) => setProjectTag(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
      </form>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300">
          Results
        </div>
        <ul className="divide-y divide-slate-800 text-xs">
          {results.map((r) => {
            const expanded = expandedIds.has(r.id)
            const lineCount = (r.content.match(/\n/g) ?? []).length + 1
            const truncate = !expanded && lineCount > MAX_PREVIEW_LINES
            const displayContent = truncate
              ? r.content.split('\n').slice(0, MAX_PREVIEW_LINES).join('\n') + (lineCount > MAX_PREVIEW_LINES ? '\n…' : '')
              : r.content
            const pct = Math.round((r.similarity ?? 0) * 100)
            const date = r.created_at
              ? new Date(r.created_at).toLocaleString(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : null
            return (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-2">
                    <span
                      className="rounded bg-slate-700 px-1.5 py-0.5 font-medium tabular-nums text-slate-200"
                      title="Similarity"
                    >
                      {pct}%
                    </span>
                    {r.domain_tag && (
                      <span className="rounded bg-slate-800 px-1 text-[10px] uppercase tracking-wide text-slate-300">
                        {r.domain_tag}
                      </span>
                    )}
                    {date && (
                      <span className="text-slate-500">{date}</span>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(r.id)) next.delete(r.id)
                      else next.add(r.id)
                      return next
                    })
                  }
                  className="mt-2 w-full text-left whitespace-pre-wrap text-slate-100 hover:text-slate-50 focus:outline-none focus:ring-0"
                >
                  {displayContent}
                  {lineCount > MAX_PREVIEW_LINES && (
                    <span className="ml-1 text-slate-400">
                      {expanded ? ' (collapse)' : ' (show more)'}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
          {results.length === 0 && (
            <li className="px-4 py-3 text-xs text-slate-500">
              No results yet. Run a search above.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

