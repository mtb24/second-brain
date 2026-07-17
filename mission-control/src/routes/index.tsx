import { createFileRoute } from '@tanstack/react-router'
import { TodayFoundation } from '@/ui/mission/WorkspaceFoundations'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  return <TodayFoundation />
}
