import { createFileRoute } from '@tanstack/react-router'
import { MarketingCommandCenter } from '@/ui/mission/MarketingCommandCenter'

export const Route = createFileRoute('/campaigns')({ component: CampaignsPage })

function CampaignsPage() {
  return <MarketingCommandCenter />
}
