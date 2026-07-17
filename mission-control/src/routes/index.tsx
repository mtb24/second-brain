import { createFileRoute } from '@tanstack/react-router'
import { TodayWorkspace } from '@/ui/mission/TodayWorkspace'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  return <TodayWorkspace />
}
