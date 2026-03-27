/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
  Link,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/styles/globals.css'

const queryClient = new QueryClient()

const navItems = [
  { to: '/work', label: 'Work' },
  { to: '/adventures', label: 'Adventures' },
  { to: '/honest-fit', label: 'Honest Fit' },
  { to: '/resume', label: 'Resume' },
  { to: '/contact', label: 'Contact' },
] as const

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Ken Downey' },
      {
        name: 'description',
        content:
          'Staff frontend engineer building AI-enabled interfaces and autonomous systems.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap',
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-void text-ink-primary">
          <SiteHeader />
          <Outlet />
        </div>
      </QueryClientProvider>
      <Scripts />
    </RootDocument>
  )
}

function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-warmborder/80 bg-void-deep/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 md:py-3.5">
        <Link
          to="/"
          className="font-medium tracking-[-0.5px] text-ink-primary transition-colors hover:text-cobalt-light"
          onClick={() => setOpen(false)}
        >
          Ken Downey
        </Link>

        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Primary"
        >
          {navItems.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="text-xs font-medium uppercase tracking-nav text-ink-secondary transition-colors hover:text-cobalt-light [&.active]:text-cobalt [&.active]:underline [&.active]:decoration-cobalt [&.active]:decoration-2 [&.active]:underline-offset-[6px]"
            >
              {label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="rounded-lg border border-warmborder px-3 py-2 text-xs font-medium uppercase tracking-nav text-ink-primary transition-colors hover:border-cobalt/50 hover:text-cobalt-light md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      <div
        id="mobile-nav"
        className={`border-t border-warmborder bg-void-deep md:hidden ${open ? 'block' : 'hidden'}`}
      >
        <nav className="flex flex-col px-6 py-3" aria-label="Mobile primary">
          {navItems.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="border-b border-warmborder/60 py-3 text-xs font-medium uppercase tracking-nav text-ink-secondary transition-colors last:border-0 hover:text-cobalt-light [&.active]:text-cobalt [&.active]:underline [&.active]:decoration-cobalt [&.active]:decoration-2 [&.active]:underline-offset-4"
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className="h-full" lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="h-full min-h-screen bg-void text-ink-primary">
        {children}
      </body>
    </html>
  )
}
