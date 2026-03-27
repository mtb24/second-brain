import { createFileRoute, redirect } from '@tanstack/react-router'
import { HONEST_FIT_URL } from '@/constants'

export const Route = createFileRoute('/honest-fit')({
  beforeLoad: () => {
    throw redirect({
      href: HONEST_FIT_URL,
    })
  },
})
