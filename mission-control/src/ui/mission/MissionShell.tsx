import type { ReactNode } from 'react'
import {
  Activity,
  BarChart3,
  Dumbbell,
  ExternalLink,
  Gauge,
  Home,
  MessageSquareText,
  Search,
  Settings2,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { HonestFitGlobalHeader } from './HonestFitGlobalHeader'

const workspaces = [
  { to: '/', label: 'Today', icon: Home },
  { to: '/product', label: 'Product', icon: BarChart3 },
  { to: '/revenue', label: 'Revenue', icon: WalletCards },
  { to: '/operations', label: 'Operations', icon: ShieldCheck },
  { to: '/feedback', label: 'Feedback', icon: MessageSquareText },
] as const

const utilities = [
  { to: '/campaigns', label: 'Campaign editor', icon: Settings2 },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/trading', label: 'Trading', icon: Activity },
  { to: '/workout', label: 'Workout', icon: Dumbbell },
] as const

export const operatorWorkspacePaths = new Set<string>(
  workspaces.map((item) => item.to),
)

function NavLink({
  to,
  label,
  icon: Icon,
  mobile = false,
}: Readonly<{
  to: string
  label: string
  icon: typeof Home
  mobile?: boolean
}>) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === '/' }}
      className={
        mobile
          ? 'flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-2 text-xs font-semibold text-blue-100 hover:bg-white/10 [&.active]:border-mission-gold [&.active]:bg-mission-gold [&.active]:text-mission-shell'
          : 'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-blue-100/80 hover:bg-white/10 hover:text-white [&.active]:bg-white/[0.12] [&.active]:text-white [&.active]:shadow-[inset_3px_0_0_rgb(var(--mc-gold))]'
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  )
}

export function MissionShell({
  children,
  showOperatorHeader,
  darkContent = false,
}: Readonly<{
  children: ReactNode
  showOperatorHeader: boolean
  darkContent?: boolean
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-mission-canvas text-mission-ink">
      <header className="border-b border-white/10 bg-mission-shell text-white">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-mission-cobalt text-white shadow-inner">
              <Gauge className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-wide">Mission Control</div>
              <div className="text-xs text-blue-200/70">Founder operator workspace</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/openclaw/"
              className="hidden min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-blue-100 hover:bg-white/10 sm:inline-flex"
            >
              OpenClaw
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <form method="post" action="/logout">
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-white/20 px-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
        <nav
          aria-label="HonestFit workspaces"
          className="grid grid-cols-3 gap-2 border-t border-white/10 px-3 py-3 lg:hidden"
        >
          {workspaces.map((item) => (
            <NavLink key={item.to} {...item} mobile />
          ))}
        </nav>
      </header>

      {showOperatorHeader ? <HonestFitGlobalHeader /> : null}

      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-white/10 bg-mission-rail px-3 py-5 text-white lg:block">
          <nav aria-label="HonestFit workspaces" className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200/55">
              HonestFit
            </div>
            {workspaces.map((item) => (
              <NavLink key={item.to} {...item} />
            ))}
          </nav>
          <nav aria-label="Mission utilities" className="mt-8 space-y-1 border-t border-white/10 pt-5">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200/55">
              Utilities
            </div>
            {utilities.map((item) => (
              <NavLink key={item.to} {...item} />
            ))}
          </nav>
        </aside>
        <main
          className={`min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 ${
            darkContent ? 'bg-slate-950 text-slate-100' : ''
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
