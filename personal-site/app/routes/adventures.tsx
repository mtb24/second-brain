import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/adventures')({
  component: AdventuresPage,
})

function AdventuresPage() {
  return (
    <main className="border-t border-warmborder pt-[52px] md:pt-[56px]">
      <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <h1 className="text-3xl font-medium tracking-[-0.5px] md:text-4xl">
          Adventures
        </h1>
        <p className="mt-4 max-w-xl text-ink-secondary">
          Photo grid, lightbox, and captions are next. For now this route exists
          so navigation matches the site map.
        </p>
      </div>
    </main>
  )
}
