/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getMcAuthOk } from '@/server/mcAuthFn'
import {
  MissionShell,
  operatorWorkspacePaths,
} from '@/ui/mission/MissionShell'
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
  const darkUtility =
    pathname === '/search' ||
    pathname === '/trading' ||
    pathname === '/workout' ||
    pathname.startsWith('/workout/')

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        {bareShell ? (
          <Outlet />
        ) : fullBleedShell ? (
          <div className="min-h-screen bg-slate-950 text-slate-100">
            <main className="min-h-screen w-full overflow-hidden">
              <Outlet />
            </main>
          </div>
        ) : (
          <MissionShell
            showOperatorHeader={operatorWorkspacePaths.has(pathname)}
            darkContent={darkUtility}
          >
            <Outlet />
          </MissionShell>
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
      <body className="min-h-full bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  )
}
