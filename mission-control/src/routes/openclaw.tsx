import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/openclaw')({
  component: OpenClawPage,
})

function OpenClawPage() {
  return (
    <div
      className="w-full"
      style={{ height: 'calc(100vh - 3.5rem)' }}
    >
      <iframe
        src="/openclaw/"
        title="OpenClaw Control"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        className="h-full w-full border-0"
      />
    </div>
  )
}
