import { createFileRoute, Link } from '@tanstack/react-router'
import { HONEST_FIT_URL } from '@/constants'
import { coreStrengths, siteSubHeadline } from '@/data/kenProfile'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const techTags = ['React', 'TypeScript', 'Design Systems', 'AI Agents'] as const

type FeaturedProject = {
  title: string
  blurb: string
  tags: readonly string[]
  href: string
  external?: boolean
}

const featured: FeaturedProject[] = [
  {
    title: 'Second Brain',
    blurb:
      'Personal OS with autonomous agents, ingest pipeline, Mission Control, and live trading tournament.',
    tags: ['TanStack Start', 'Python', 'Postgres', 'OpenClaw'],
    href: '/work',
  },
  {
    title: 'Design Systems',
    blurb:
      'Contract layer for AI-generated UI — validated against design system constraints before it ships.',
    tags: ['React', 'TypeScript'],
    href: '/work',
  },
  {
    title: 'Trading tournament',
    blurb:
      'Parallel strategy bots, shared market sim, and live charts — Claude-powered decisions.',
    tags: ['TypeScript', 'Claude API', 'Postgres'],
    href: '/work',
  },
  {
    title: 'Honest Fit Assessment',
    blurb:
      'Job fit analysis that blends deterministic checks with LLM reasoning.',
    tags: ['AI', 'Product'],
    href: HONEST_FIT_URL,
    external: true,
  },
]

const howIThink = [
  {
    title: 'Design systems that get adopted',
    body:
      "Most design systems die because they're component libraries without governance. Tokens, constraints, and adoption pathways matter more than the components.",
  },
  {
    title: 'Constraining AI-generated UI',
    body:
      "LLMs can write React, but they can't follow your design system. The missing piece is a contract layer that validates AI output against real component APIs before it ships.",
  },
  {
    title: 'Building systems that run without you',
    body:
      'The best infrastructure is the kind you forget about. My Second Brain runs tournament rounds every 3 hours, proposes strategies every 12, and updates its own documentation on command.',
  },
  {
    title: 'Fixing messy frontends',
    body:
      'I step into legacy React codebases, untangle shared state, extract reusable patterns, and leave behind systems that scale. Most of my career has been cleaning up what others started.',
  },
] as const

const coreStrengthColumns = [
  coreStrengths.slice(0, 3),
  coreStrengths.slice(3, 6),
  coreStrengths.slice(6, 8),
] as const

function HomePage() {
  return (
    <div className="pt-[52px] md:pt-[56px]">
      <section className="relative isolate min-h-[72vh] overflow-hidden bg-void-deep">
        {/* Swap to a full-bleed adventure photo + dark overlay when `/public/images/hero.jpg` exists */}
        <div className="relative mx-auto flex max-w-6xl flex-col justify-end gap-8 px-6 pb-16 pt-24 md:min-h-[72vh] md:pb-24 md:pt-32">
          <div
            className="h-[3px] w-[72px] shrink-0 rounded-sm bg-cobalt"
            aria-hidden
          />

          <div className="max-w-3xl space-y-6">
            <h1 className="text-4xl font-medium tracking-[-0.5px] text-[#f0e8d8] md:text-5xl lg:text-6xl">
              Ken Downey
            </h1>
            <p className="text-lg text-ink-secondary md:text-xl md:leading-relaxed">
              {siteSubHeadline}
            </p>
            <ul className="flex flex-wrap gap-2">
              {techTags.map((tag) => (
                <li key={tag}>
                  <span className="inline-block rounded-full border-[0.5px] border-cobalt bg-transparent px-3 py-1 text-xs font-medium text-cobalt">
                    {tag}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/work"
                className="inline-flex items-center justify-center rounded-lg bg-cobalt px-5 py-2.5 text-sm font-medium text-[#f0e8d8] shadow-cobalt-glow transition-colors hover:bg-cobalt-light"
              >
                See my work
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center rounded-lg border-[0.5px] border-cobalt bg-transparent px-5 py-2.5 text-sm font-medium text-cobalt transition-colors hover:border-cobalt hover:bg-cobalt hover:text-[#f0e8d8]"
              >
                Get in touch
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-warmborder py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-10 text-sm font-medium uppercase tracking-nav text-cobalt">
            Core strengths
          </h2>
          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            {coreStrengthColumns.map((col, i) => (
              <ul
                key={i}
                className="space-y-4 text-[15px] leading-relaxed text-ink-secondary md:text-base md:leading-relaxed"
              >
                {col.map((line) => (
                  <li key={line} className="flex gap-3">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cobalt"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-warmborder bg-void-deep py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-10 text-sm font-medium uppercase tracking-nav text-cobalt">
            Featured work
          </h2>
          <ul className="grid gap-6 md:grid-cols-2">
            {featured.map((project) => {
              const cardClass =
                'group block h-full rounded-lg border-[0.5px] border-warmborder bg-surface p-6 transition-colors hover:border-cobalt/40 hover:shadow-cobalt-glow'
              const inner = (
                <>
                  <h3 className="text-lg font-medium tracking-[-0.5px] text-[#f0e8d8] group-hover:text-cobalt-light">
                    {project.title}
                  </h3>
                  <p className="mt-2 text-ink-secondary">{project.blurb}</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {project.tags.map((t) => (
                      <li key={t}>
                        <span className="inline-block rounded-full border-[0.5px] border-cobalt/80 bg-transparent px-2.5 py-0.5 font-mono text-[11px] text-cobalt">
                          {t}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )
              return (
                <li key={project.title}>
                  {project.external ? (
                    <a
                      href={project.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cardClass}
                    >
                      {inner}
                    </a>
                  ) : (
                    <Link to={project.href} className={cardClass}>
                      {inner}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section className="border-t border-warmborder bg-void-deep py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-10 text-sm font-medium uppercase tracking-nav text-cobalt">
            How I think
          </h2>
          <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {howIThink.map((item) => (
              <li key={item.title}>
                <article className="flex h-full flex-col rounded-lg border-[0.5px] border-warmborder bg-surface p-6 transition-colors hover:border-cobalt/40 hover:shadow-cobalt-glow">
                  <h3 className="text-base font-medium tracking-[-0.5px] text-[#f0e8d8]">
                    {item.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-secondary md:text-[15px] md:leading-relaxed">
                    {item.body}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-warmborder py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-[1fr_280px] md:items-start md:gap-14">
          <div className="space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-nav text-ink-secondary">
              About
            </h2>
            <p className="text-ink-secondary">
              I build interfaces where design systems, runtime performance, and
              AI-assisted workflows meet. Outside the keyboard: desert miles,
              dirt bikes, and the occasional gold pan.
            </p>
          </div>
          <div
            className="flex aspect-[4/5] max-w-sm items-center justify-center rounded-lg border-[0.5px] border-dashed border-warmborder bg-surface-muted text-center text-sm text-ink-secondary md:mx-0 md:max-w-none"
            role="img"
            aria-label="Personal photo placeholder"
          >
            Photo
            <br />
            <span className="text-xs opacity-70">Drop in /public/images/</span>
          </div>
        </div>
      </section>
    </div>
  )
}
