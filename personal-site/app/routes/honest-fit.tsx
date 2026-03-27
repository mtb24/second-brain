import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/honest-fit')({
  component: HonestFitPage,
})

function HonestFitPage() {
  return (
    <main className="border-t border-warmborder pt-[52px] md:pt-[56px]">
      <div className="mx-auto max-w-2xl px-4 py-14 md:py-20">
        <h1 className="text-3xl font-medium tracking-[-0.5px] md:text-4xl">
          Honest Fit Assessment
        </h1>
        <p className="mt-4 text-ink-secondary">
          AI-powered job fit assessment using hybrid deterministic + LLM
          reasoning.
        </p>
        <p className="mt-6 rounded-lg border-[0.5px] border-warmborder bg-surface px-4 py-3 text-sm text-ink-secondary">
          Coming soon — full interactive flow ships in a later pass.
        </p>
      </div>
    </main>
  )
}
