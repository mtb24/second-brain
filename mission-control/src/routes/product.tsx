import { createFileRoute } from '@tanstack/react-router'
import { ProductWorkspace } from '@/ui/mission/ProductWorkspace'

export const Route = createFileRoute('/product')({ component: ProductWorkspace })
