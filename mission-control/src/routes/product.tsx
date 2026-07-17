import { createFileRoute } from '@tanstack/react-router'
import { ProductFoundation } from '@/ui/mission/WorkspaceFoundations'

export const Route = createFileRoute('/product')({ component: ProductFoundation })
