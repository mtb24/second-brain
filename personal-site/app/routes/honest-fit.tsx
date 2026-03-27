import { createFileRoute } from '@tanstack/react-router'
import { InnerPageShell } from '@/ui/InnerPageShell'
import { PageHeader } from '@/ui/PageHeader'

export const Route = createFileRoute('/honest-fit')({
  component: HonestFitPage,
})

function HonestFitPage() {
  return (
    <InnerPageShell>
      <PageHeader
        kicker="Honest Fit"
        title="Honest Fit Assessment"
        description={
          <p>
            AI-powered job fit assessment using hybrid deterministic + LLM
            reasoning.
          </p>
        }
      />
      <div className="max-w-2xl space-y-6">
        <p className="rounded-lg border-[0.5px] border-warmborder bg-surface px-4 py-3 text-sm text-ink-secondary">
          Coming soon — full interactive flow ships in a later pass.
        </p>
      </div>
    </InnerPageShell>
  )
}
