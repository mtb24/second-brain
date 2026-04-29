import { createFileRoute } from '@tanstack/react-router'
import { SystemHealthPanel } from '@/ui/SystemHealthPanel'
import { AgentRosterPanel } from '@/ui/AgentRosterPanel'
import { HonestFitTelemetryPanel } from '@/ui/HonestFitTelemetryPanel'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <section className="space-y-4 xl:col-span-2">
        <h2 className="text-sm font-semibold text-slate-200">
          System health
        </h2>
        <SystemHealthPanel />
        <HonestFitTelemetryPanel />
      </section>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Agents</h2>
        <AgentRosterPanel />
      </section>
    </div>
  )
}
