import { createFileRoute } from '@tanstack/react-router'
import { OperationsWorkspace } from '@/ui/mission/OperationsWorkspace'

export const Route = createFileRoute('/operations')({ component: OperationsWorkspace })
