import type { ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  clearCapitalExperience,
  frogCombinedCaseStudy,
  portlandCaseStudyExperience,
  stories,
  talageExperience,
  type ProfileExperience,
} from '@/data/kenProfile'
import { InnerPageShell } from '@/ui/InnerPageShell'
import { PageHeader } from '@/ui/PageHeader'

export const Route = createFileRoute('/work')({
  component: WorkPage,
})

function formatRange(start: string, end: string | null) {
  return `${start} – ${end ?? 'Present'}`
}

function TechPills({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((t) => (
        <li key={t}>
          <span className="inline-block rounded-full border-[0.5px] border-cobalt bg-transparent px-2.5 py-0.5 font-mono text-[11px] text-cobalt">
            {t}
          </span>
        </li>
      ))}
    </ul>
  )
}

function DomainTag({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-nav text-cobalt/90">
      {children}
    </p>
  )
}

function ProfileCaseStudyCard({
  storyTitle,
  exp,
}: {
  storyTitle?: string
  exp: ProfileExperience
}) {
  return (
    <article className="rounded-lg border-[0.5px] border-warmborder bg-surface p-6 transition-colors hover:border-cobalt/35 hover:shadow-cobalt-glow md:p-8">
      <header className="border-b border-warmborder/80 pb-6">
        {storyTitle ? (
          <p className="mb-2 text-sm font-medium text-[#e8e0d0]">{storyTitle}</p>
        ) : null}
        <h2 className="text-xl font-medium tracking-[-0.5px] text-[#f0e8d8] md:text-2xl">
          {exp.company}
        </h2>
        <p className="mt-2 text-base text-cobalt-light">{exp.role}</p>
        <p className="mt-1 text-sm text-ink-secondary">
          {formatRange(exp.start, exp.end)}
          {exp.location ? ` · ${exp.location}` : ''}
        </p>
        <div className="mt-4">
          <DomainTag>{exp.domain}</DomainTag>
        </div>
      </header>

      <div className="mt-6 space-y-6">
        <section>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-nav text-cobalt">
            Highlights
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-secondary md:text-base md:leading-[1.7]">
            {exp.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-nav text-cobalt">
            Tech stack
          </h3>
          <TechPills items={exp.stack} />
        </section>
      </div>

      {exp.links && exp.links.length > 0 ? (
        <footer className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-t border-warmborder/80 pt-6">
          {exp.links.map((link) => (
            <a
              key={link.url + link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-cobalt transition-colors hover:text-cobalt-light"
            >
              {link.label} →
            </a>
          ))}
        </footer>
      ) : null}
    </article>
  )
}

function FrogCaseStudyCard() {
  const f = frogCombinedCaseStudy
  return (
    <article className="rounded-lg border-[0.5px] border-warmborder bg-surface p-6 transition-colors hover:border-cobalt/35 hover:shadow-cobalt-glow md:p-8">
      <header className="border-b border-warmborder/80 pb-6">
        <h2 className="text-xl font-medium tracking-[-0.5px] text-[#f0e8d8] md:text-2xl">
          {f.company}
        </h2>
        <p className="mt-2 text-base text-cobalt-light">{f.role}</p>
        <p className="mt-1 text-sm text-ink-secondary">
          {f.clientLine}
        </p>
        <p className="mt-1 text-sm text-ink-secondary">
          {formatRange(f.start, f.end)} · Remote, USA
        </p>
        <div className="mt-4">
          <DomainTag>{f.domain}</DomainTag>
        </div>
      </header>

      <div className="mt-6 space-y-6">
        <section>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-nav text-cobalt">
            Highlights
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-secondary md:text-base md:leading-[1.7]">
            {f.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-nav text-cobalt">
            Tech stack
          </h3>
          <TechPills items={f.stack} />
        </section>
      </div>
    </article>
  )
}

const secondBrainHighlights = [
  'Architected and built the entire stack solo: Postgres with pgvector, FastAPI ingest service, MCP server for IDE integration, OpenClaw agent (Cortex) for Telegram capture, Mission Control dashboard, and a genetic-algorithm trading tournament with Claude-powered strategy bots.',
  'Ingest, semantic search, and agent orchestration in one system — no off-the-shelf product matched the workflow.',
  'Tournament runs automatically every 3 hours; Strategy Master proposes new strategies every 12 hours; 13+ strategies tested and evolved.',
] as const

const secondBrainStack = [
  'TypeScript',
  'Python',
  'FastAPI',
  'Postgres',
  'pgvector',
  'Docker',
  'Nginx',
  'OpenClaw',
  'TanStack Start',
  'Claude API',
] as const

const aiContractStack = [
  'React',
  'TypeScript',
  'JSON Schema',
  'LLM integration',
] as const

function CustomCaseStudyCard({
  company,
  role,
  dateRange,
  location,
  domain,
  highlights,
  stack,
  links,
}: {
  company: string
  role: string
  dateRange?: string
  location?: string
  domain: string
  highlights: readonly string[]
  stack: readonly string[]
  links?: readonly { label: string; href: string; external?: boolean }[]
}) {
  return (
    <article className="rounded-lg border-[0.5px] border-warmborder bg-surface p-6 transition-colors hover:border-cobalt/35 hover:shadow-cobalt-glow md:p-8">
      <header className="border-b border-warmborder/80 pb-6">
        <h2 className="text-xl font-medium tracking-[-0.5px] text-[#f0e8d8] md:text-2xl">
          {company}
        </h2>
        <p className="mt-2 text-base text-cobalt-light">{role}</p>
        {(dateRange || location) && (
          <p className="mt-1 text-sm text-ink-secondary">
            {[dateRange, location].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="mt-4">
          <DomainTag>{domain}</DomainTag>
        </div>
      </header>

      <div className="mt-6 space-y-6">
        <section>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-nav text-cobalt">
            Highlights
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-secondary md:text-base md:leading-[1.7]">
            {highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-nav text-cobalt">
            Tech stack
          </h3>
          <TechPills items={stack} />
        </section>
      </div>

      {links && links.length > 0 ? (
        <footer className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-t border-warmborder/80 pt-6">
          {links.map((link) =>
            link.external ? (
              <a
                key={link.href + link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-cobalt transition-colors hover:text-cobalt-light"
              >
                {link.label} →
              </a>
            ) : (
              <Link
                key={link.href + link.label}
                to={link.href}
                className="text-sm font-medium text-cobalt transition-colors hover:text-cobalt-light"
              >
                {link.label} →
              </Link>
            ),
          )}
        </footer>
      ) : null}
    </article>
  )
}

function WorkPage() {
  const ai = stories.ai_output_governance

  return (
    <InnerPageShell>
      <PageHeader
        kicker="Work"
        title="Case studies"
        description={
          <p>
            Selected engagements from my profile — government design systems,
            enterprise SaaS, consultancy delivery, and personal R&D.
          </p>
        }
      />

      <div className="space-y-10 md:space-y-12">
        <ProfileCaseStudyCard
          storyTitle={stories.portland_design_system.title}
          exp={portlandCaseStudyExperience}
        />
        <ProfileCaseStudyCard
          storyTitle={stories.clear_capital_b2b_saas.title}
          exp={clearCapitalExperience}
        />
        <FrogCaseStudyCard />
        <CustomCaseStudyCard
          company="Second Brain"
          role="Architect & builder (personal project)"
          domain="Personal OS, AI agents, semantic search, autonomous trading"
          highlights={secondBrainHighlights}
          stack={secondBrainStack}
          links={[
            {
              label: 'Mission Control',
              href: 'https://mission.kendowney.com',
              external: true,
            },
            {
              label: 'Trading',
              href: 'https://mission.kendowney.com/trading',
              external: true,
            },
          ]}
        />
        <CustomCaseStudyCard
          company={ai.title}
          role="Research & prototype"
          domain="AI output governance, design system contracts, LLM + UI"
          highlights={[ai.summary, ...ai.takeaways]}
          stack={aiContractStack}
          links={[
            {
              label: "Ken's AI Experiments (YouTube)",
              href: 'https://www.youtube.com/results?search_query=Ken%27s+AI+Experiments',
              external: true,
            },
          ]}
        />
        <ProfileCaseStudyCard exp={talageExperience} />
      </div>
    </InnerPageShell>
  )
}
