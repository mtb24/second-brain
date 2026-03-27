import { createFileRoute } from '@tanstack/react-router'
import { InnerPageShell } from '@/ui/InnerPageShell'
import { PageHeader } from '@/ui/PageHeader'

export const Route = createFileRoute('/contact')({
  component: ContactPage,
})

function ContactPage() {
  return (
    <InnerPageShell>
      <PageHeader
        title="Contact"
        description={
          <p className="max-w-2xl">
            Full contact page with form and social links is specified for a
            later pass. For now, use the stub or reach out via GitHub.
          </p>
        }
      />
    </InnerPageShell>
  )
}
