/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
  Link,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '../index.css'

const queryClient = new QueryClient()

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Mission Control' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <header className="z-10 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-sm font-semibold tracking-wide text-slate-100">
                  Mission Control
                </span>
              </div>
              <nav className="flex gap-4 text-sm text-slate-300">
                <Link to="/" className="[&.active]:text-emerald-400">
                  Dashboard
                </Link>
                <Link to="/thoughts" className="[&.active]:text-emerald-400">
                  Thoughts
                </Link>
                <Link to="/search" className="[&.active]:text-emerald-400">
                  Search
                </Link>
                <Link to="/agents" className="[&.active]:text-emerald-400">
                  Agents
                </Link>
                <Link to="/trading" className="[&.active]:text-emerald-400">
                  Trading
                </Link>
                <Link to="/openclaw" className="[&.active]:text-emerald-400">
                  OpenClaw
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-6">
            <Outlet />
          </main>
        </div>
      </QueryClientProvider>
      <Scripts />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className="h-full" lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="h-full bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  )
}

