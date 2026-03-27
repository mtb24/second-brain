import { createFileRoute } from '@tanstack/react-router'
import { InnerPageShell } from '@/ui/InnerPageShell'
import { PageHeader } from '@/ui/PageHeader'

export const Route = createFileRoute('/resume')({
  component: ResumePage,
})

function ResumePage() {
  return (
    <InnerPageShell>
      <PageHeader
        title="Resume"
        description={
          <p className="max-w-xl">
            Experience timeline and downloadable PDF will go here — stub route
            for navigation.
          </p>
        }
      />
    </InnerPageShell>
  )
}
