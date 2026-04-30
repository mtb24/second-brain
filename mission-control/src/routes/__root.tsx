/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
  Link,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getMcAuthOk } from '@/server/mcAuthFn'
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
  beforeLoad: async ({ location }) => {
    const path = location.pathname
    if (path === '/login' || path === '/logout') return
    const { ok } = await getMcAuthOk()
    if (!ok) throw redirect({ to: '/login', search: { error: undefined } })
  },
  component: RootComponent,
})

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const bareShell = pathname === '/login' || pathname === '/logout'

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        {bareShell ? (
          <Outlet />
        ) : (
          <div className="min-h-screen bg-slate-950 text-slate-100">
            <header className="z-10 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
              <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-semibold tracking-wide text-slate-100">
                    Mission Control
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <nav className="flex flex-wrap gap-4 text-sm text-slate-300">
                    <Link to="/" className="[&.active]:text-emerald-400">
                      Dashboard
                    </Link>
                    <Link to="/search" className="[&.active]:text-emerald-400">
                      Search
                    </Link>
                    <Link to="/trading" className="[&.active]:text-emerald-400">
                      Trading
                    </Link>
                    <Link to="/workout" className="[&.active]:text-emerald-400">
                      Workout
                    </Link>
                    <Link to="/openclaw" className="[&.active]:text-emerald-400">
                      OpenClaw
                    </Link>
                  </nav>
                  <form method="post" action="/logout">
                    <button
                      type="submit"
                      className="rounded-md border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white"
                    >
                      Log out
                    </button>
                  </form>
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-6">
              <Outlet />
            </main>
          </div>
        )}
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
