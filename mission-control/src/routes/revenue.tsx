import { createFileRoute } from '@tanstack/react-router'
import { RevenueWorkspace } from '@/ui/mission/RevenueWorkspace'

export const Route = createFileRoute('/revenue')({ component: RevenueWorkspace })
