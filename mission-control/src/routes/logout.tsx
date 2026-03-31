import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/logout')({
  component: () => <Navigate to="/" replace />,
  server: {
    handlers: {
      POST: async () => {
        const { handleMcLogoutPost } = await import('@/server/mcLogoutPost')
        return await handleMcLogoutPost()
      },
    },
  },
})
