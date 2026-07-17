import { createFileRoute } from '@tanstack/react-router'
import { FeedbackFoundation } from '@/ui/mission/WorkspaceFoundations'

export const Route = createFileRoute('/feedback')({ component: FeedbackFoundation })
