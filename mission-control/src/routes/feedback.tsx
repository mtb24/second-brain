import { createFileRoute } from '@tanstack/react-router'
import { FeedbackWorkspace } from '@/ui/mission/FeedbackWorkspace'

export const Route = createFileRoute('/feedback')({ component: FeedbackWorkspace })
