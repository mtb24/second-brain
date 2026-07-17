import { createFileRoute } from '@tanstack/react-router'
import { OperationsFoundation } from '@/ui/mission/WorkspaceFoundations'

export const Route = createFileRoute('/operations')({ component: OperationsFoundation })
