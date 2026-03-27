import { createFileRoute } from '@tanstack/react-router'
import { InnerPageShell } from '@/ui/InnerPageShell'
import { PageHeader } from '@/ui/PageHeader'

export const Route = createFileRoute('/adventures')({
  component: AdventuresPage,
})

function AdventuresPage() {
  return (
    <InnerPageShell>
      <PageHeader
        title="Adventures"
        description={
          <p className="max-w-xl">
            Photo grid, lightbox, and captions are next. For now this route
            exists so navigation matches the site map.
          </p>
        }
      />
    </InnerPageShell>
  )
}
