import { createFileRoute } from '@tanstack/react-router'
import { SystemHealthPanel } from '@/ui/SystemHealthPanel'
import { AgentRosterPanel } from '@/ui/AgentRosterPanel'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">
          System health
        </h2>
        <SystemHealthPanel />
      </section>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Agents</h2>
        <AgentRosterPanel />
      </section>
    </div>
  )
}

