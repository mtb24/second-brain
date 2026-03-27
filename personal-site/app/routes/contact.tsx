import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contact')({
  component: ContactPage,
})

function ContactPage() {
  return (
    <main className="border-t border-warmborder pt-[52px] md:pt-[56px]">
      <div className="mx-auto max-w-2xl px-4 py-14 md:py-20">
        <h1 className="text-3xl font-medium tracking-[-0.5px] md:text-4xl">
          Contact
        </h1>
        <p className="mt-4 text-ink-secondary">
          Full contact page with form and social links is specified for a later
          pass. For now, use the stub or reach out via GitHub.
        </p>
      </div>
    </main>
  )
}
