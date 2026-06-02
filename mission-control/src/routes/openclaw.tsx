import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/openclaw')({
  component: OpenClawPage,
})

function OpenClawPage() {
  return (
    <div className="flex min-h-80 items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-white">OpenClaw</h1>
        <p className="mt-2 max-w-md text-sm text-slate-300">
          OpenClaw runs outside the Mission Control app shell.
        </p>
        <a
          href="/openclaw/"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-slate-700 px-4 text-sm font-semibold text-slate-100 hover:bg-slate-800"
        >
          Open OpenClaw
        </a>
      </div>
    </div>
  )
}
