import { type ReactElement } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { InnerPageShell } from '@/ui/InnerPageShell'
import { PageHeader } from '@/ui/PageHeader'

export const Route = createFileRoute('/adventures')({
  component: AdventuresPage,
})

const INSTAGRAM_URL = 'https://www.instagram.com/_._k.2_._/'

type Adventure = {
  title: string
  description: string
  icon: ReactElement
}

function IconRacing() {
  return (
    <svg
      className="h-14 w-14 text-cobalt/90"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M8 44h48M14 44l8-24h20l8 24M22 20l4-8h12l4 8" />
      <circle cx="20" cy="44" r="6" />
      <circle cx="44" cy="44" r="6" />
    </svg>
  )
}

function IconGravel() {
  return (
    <svg
      className="h-14 w-14 text-cobalt/90"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="32" cy="38" r="14" />
      <path d="M32 24v-8M22 18l6 4M42 18l-6 4" />
      <path d="M18 46l-6 6M46 46l6 6" strokeLinecap="round" />
    </svg>
  )
}

function IconProspect() {
  return (
    <svg
      className="h-14 w-14 text-cobalt/90"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M32 8L12 48h40L32 8z" />
      <circle cx="32" cy="36" r="6" fill="currentColor" opacity="0.35" stroke="none" />
    </svg>
  )
}

function IconOverland() {
  return (
    <svg
      className="h-14 w-14 text-cobalt/90"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M8 40h48v8H8zM12 40V28h16l8-12h16v24" />
      <path d="M20 40v-8h8v8M44 28v12" />
    </svg>
  )
}

function IconMoto() {
  return (
    <svg
      className="h-14 w-14 text-cobalt/90"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="18" cy="44" r="8" />
      <circle cx="48" cy="44" r="8" />
      <path d="M26 44h12M32 20l-6 24M32 20l14 8-4 16" />
    </svg>
  )
}

function IconExplore() {
  return (
    <svg
      className="h-14 w-14 text-cobalt/90"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="32" cy="32" r="22" />
      <path d="M32 18v28M22 32h20" strokeLinecap="round" />
      <polygon
        points="32,14 36,24 32,22 28,24"
        fill="currentColor"
        stroke="none"
        opacity="0.6"
      />
    </svg>
  )
}

const adventures: Adventure[] = [
  {
    title: 'Baja Racing',
    description:
      'SCORE SF250, Pro Moto 50, team #527x — desert miles, checkpoints, and race fuel.',
    icon: <IconRacing />,
  },
  {
    title: 'Gravel Cycling',
    description: 'Long gravel routes, dust, and big-sky endurance days.',
    icon: <IconGravel />,
  },
  {
    title: 'Gold & Silver Prospecting',
    description: 'Pans, creeks, and dry washes — geology as weekend sport.',
    icon: <IconProspect />,
  },
  {
    title: 'Overlanding',
    description: 'Self-supported trips, camp setups, and backcountry logistics.',
    icon: <IconOverland />,
  },
  {
    title: 'Off-Road Motorcycling',
    description: 'Single track, sand washes, and technical desert riding.',
    icon: <IconMoto />,
  },
  {
    title: 'Outdoor Exploration',
    description: 'Maps, peaks, and wherever the trail runs out.',
    icon: <IconExplore />,
  },
]

function AdventuresPage() {
  return (
    <InnerPageShell>
      <PageHeader
        kicker="Adventures"
        title="Outside the editor"
        description={
          <p className="max-w-2xl">
            Desert, dirt, and distance. Photo stories will land here soon — for
            now, a grid of the threads that usually show up in the margins.
          </p>
        }
      />

      <ul className="grid gap-6 md:grid-cols-2">
        {adventures.map((a) => (
          <li key={a.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-lg border-[0.5px] border-warmborder bg-surface transition-colors hover:border-cobalt/35 hover:shadow-cobalt-glow">
              <div
                className="relative flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-surface-muted via-[#252018] to-void-deep"
                aria-hidden
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(0,71,171,0.12),transparent_50%)]" />
                {a.icon}
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h2 className="text-lg font-medium tracking-[-0.5px] text-[#f0e8d8]">
                  {a.title}
                </h2>
                <p className="mt-2 flex-1 text-sm text-ink-secondary">
                  {a.description}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>

      <footer className="mt-16 border-t border-warmborder pt-10 text-center md:text-left">
        <p className="text-ink-secondary">
          Follow the adventures on{' '}
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-cobalt transition-colors hover:text-cobalt-light"
          >
            Instagram
          </a>
        </p>
        <p className="mt-6 text-sm text-ink-secondary">
          <Link
            to="/"
            className="font-medium text-cobalt transition-colors hover:text-cobalt-light"
          >
            Home
          </Link>
          {' · '}
          <Link
            to="/contact"
            className="font-medium text-cobalt transition-colors hover:text-cobalt-light"
          >
            Contact
          </Link>
        </p>
      </footer>
    </InnerPageShell>
  )
}
