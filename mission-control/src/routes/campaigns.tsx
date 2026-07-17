import { createFileRoute } from '@tanstack/react-router'
import { HonestFitCampaignEditor } from '@/ui/HonestFitTelemetryPanel'

export const Route = createFileRoute('/campaigns')({ component: CampaignsPage })

function CampaignsPage() {
  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <div className="mission-eyebrow">Campaign editor</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-mission-ink">
          HonestFit campaign controls
        </h1>
        <p className="mission-meta mt-2">
          Existing editor capabilities remain available while operator telemetry moves into focused workspaces.
        </p>
      </header>
      <div className="rounded-xl bg-mission-shell p-2 sm:p-4">
        <HonestFitCampaignEditor />
      </div>
    </div>
  )
}
