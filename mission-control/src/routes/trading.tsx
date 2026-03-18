import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useState } from 'react'

const TradingRuleSchema = z.object({
  tier: z.string(),
  duration_days: z.number(),
  threshold_pct: z.number(),
})

const BracketResponseSchema = z.array(TradingRuleSchema)

type TradingRule = z.infer<typeof TradingRuleSchema>

async function fetchBracket(): Promise<TradingRule[]> {
  const res = await fetch('/api/ingest/trading/bracket')
  if (!res.ok) {
    throw new Error('Failed to load bracket config')
  }
  const data = await res.json()
  return BracketResponseSchema.parse(data)
}

async function saveBracket(rules: TradingRule[]): Promise<TradingRule[]> {
  const res = await fetch('/api/ingest/trading/bracket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rules),
  })
  if (!res.ok) {
    throw new Error('Failed to save bracket config')
  }
  const data = await res.json()
  return BracketResponseSchema.parse(data)
}

export const Route = createFileRoute('/trading')({
  component: TradingPage,
})

function TradingPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['trading-bracket'],
    queryFn: fetchBracket,
    refetchInterval: 60_000,
  })

  const [local, setLocal] = useState<TradingRule[] | null>(null)

  const mutation = useMutation({
    mutationFn: saveBracket,
    onSuccess: (rules) => {
      queryClient.setQueryData(['trading-bracket'], rules)
    },
  })

  const rules = local ?? data ?? []

  function updateRule(index: number, partial: Partial<TradingRule>) {
    setLocal((prev) => {
      const list = prev ?? data ?? []
      const next = [...list]
      next[index] = { ...next[index]!, ...partial }
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rules.length === 0) return
    mutation.mutate(rules)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-sm font-semibold text-slate-100">
        Trading bracket configuration
      </h1>
      {isLoading && (
        <div className="text-xs text-slate-500">Loading config…</div>
      )}
      {error && (
        <div className="text-xs text-red-400">
          {(error as Error).message}
        </div>
      )}
      {rules.length > 0 && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-slate-400">
              <span>Tier</span>
              <span>Duration (days)</span>
              <span>Threshold (%)</span>
            </div>
            {rules.map((rule, i) => (
              <div key={rule.tier} className="grid grid-cols-3 gap-2">
                <input
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  value={rule.tier}
                  onChange={(e) => updateRule(i, { tier: e.target.value })}
                  readOnly
                  title="Tier is read-only"
                />
                <input
                  type="number"
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  value={rule.duration_days}
                  onChange={(e) =>
                    updateRule(i, { duration_days: Number(e.target.value) })
                  }
                />
                <input
                  type="number"
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  value={rule.threshold_pct}
                  onChange={(e) =>
                    updateRule(i, { threshold_pct: Number(e.target.value) })
                  }
                  step="0.01"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
            {mutation.isError && (
              <span className="text-xs text-red-400">
                {(mutation.error as Error).message}
              </span>
            )}
            {mutation.isSuccess && (
              <span className="text-xs text-emerald-400">
                Saved.
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

