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
  const fullBleedShell = pathname === '/openclaw'

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        {bareShell ? (
          <Outlet />
        ) : (
          <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
            <header className="z-10 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
              <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-semibold tracking-wide text-slate-100">
                    Mission Control
                  </span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
                  <nav className="flex min-w-0 flex-wrap gap-3 text-sm text-slate-300 sm:gap-4">
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
                    <a href="/openclaw/" className="text-slate-300 hover:text-emerald-400">
                      OpenClaw
                    </a>
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
            <main className={fullBleedShell
              ? 'min-h-0 w-full flex-1 overflow-hidden'
              : 'mx-auto w-full max-w-7xl flex-1 px-4 py-6'}
            >
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
