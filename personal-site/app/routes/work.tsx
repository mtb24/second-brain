import type { ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { InnerPageShell } from '@/ui/InnerPageShell'
import { PageHeader } from '@/ui/PageHeader'

export const Route = createFileRoute('/work')({
  component: WorkPage,
})

type CaseStudyLink = {
  label: string
  href: string
  external?: boolean
}

type CaseStudy = {
  title: string
  subtitle?: string
  context: string
  problem: string
  role: string
  tech: readonly string[]
  outcome: string
  links?: readonly CaseStudyLink[]
}

const caseStudies: CaseStudy[] = [
  {
    title: 'City of Portland Design System',
    subtitle: 'ICF',
    context:
      'City government needed unified digital services across departments so residents could complete tasks online without hitting a different look, feel, and behavior on every site.',
    problem:
      'Fragmented UI: each department built its own components, there was no shared design language, and accessibility gaps showed up wherever patterns diverged.',
    role:
      'Owned frontend architecture. Built and published @cityofportland/component-library and @cityofportland/design-tokens as production npm packages. Defined the token pipeline, component API standards, and Storybook documentation so teams could ship consistently.',
    tech: [
      'React',
      'TypeScript',
      'Storybook',
      'Design Tokens',
      'npm publishing',
    ],
    outcome:
      'City-wide adoption across departments. The public packages remain in use today.',
    links: [
      {
        label: 'Packages on npm',
        href: 'https://www.npmjs.com/search?q=scope%3Acityofportland',
        external: true,
      },
    ],
  },
  {
    title: 'Clear Capital',
    subtitle: 'Property analytics platform',
    context:
      'Real estate analytics platform serving appraisers and lenders — dense property data, review queues, and decisions that have to hold up under scrutiny.',
    problem:
      'Complex property review workflows and data-heavy dashboards made it hard to move through reviews quickly without losing context or missing critical fields.',
    role:
      'Led frontend architecture for property analytics dashboards and review workflows. Built interactive data visualizations and streamlined multi-step review so appraisers could focus on judgment, not hunting for the next control.',
    tech: ['React', 'TypeScript', 'Data visualization'],
    outcome:
      'Improved appraiser workflow efficiency and reduced time spent in review cycles.',
  },
  {
    title: 'Second Brain',
    subtitle: 'Personal project',
    context:
      'A personal operating system for knowledge capture, AI agents, and autonomous trading — one place to ingest thoughts, query semantically, and run experiments that do not need a human in the loop every hour.',
    problem:
      'No off-the-shelf product combined voice capture, semantic search, AI agent orchestration, and a live trading tournament in a single system wired to how I actually work.',
    role:
      'Architected and built the entire stack solo: Postgres with pgvector, FastAPI ingest service, MCP server for IDE integration, OpenClaw agent (Cortex) for Telegram capture, Mission Control dashboard, and a genetic-algorithm trading tournament with Claude-powered strategy bots.',
    tech: [
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
    ],
    outcome:
      'Fully operational: tournament runs automatically every 3 hours, Strategy Master proposes new strategies every 12 hours, and 13+ strategies have been tested and evolved in the wild.',
    links: [
      { label: 'Mission Control', href: 'https://mission.kendowney.com', external: true },
      { label: 'Trading', href: 'https://mission.kendowney.com/trading', external: true },
    ],
  },
  {
    title: 'AI Design System Contract Layer',
    subtitle: 'Research project',
    context:
      'Large language models can generate UI code, but that output rarely conforms to an existing design system — it is fast, but it is not governed.',
    problem:
      'AI-generated components tend toward arbitrary styling, invented props, and layouts that violate design system constraints. There was no validation layer between LLM output and what actually renders in production.',
    role:
      'Designed a contract validation layer between LLM-generated UI and the render pipeline: map output to approved React components, enforce token usage, and reject non-conforming output. Conceptual and prototype stage with working validation logic.',
    tech: ['React', 'TypeScript', 'JSON Schema', 'LLM integration'],
    outcome:
      'A concrete approach to AI UI governance — no equivalent in the ecosystem I have seen. Featured on Ken’s AI Experiments on YouTube.',
    links: [
      {
        label: 'Ken’s AI Experiments (YouTube)',
        href: 'https://www.youtube.com/results?search_query=Ken%27s+AI+Experiments',
        external: true,
      },
    ],
  },
]

function WorkPage() {
  return (
    <InnerPageShell>
      <PageHeader
        kicker="Work"
        title="Case studies"
        description={
          <p>
            Production systems, public design infrastructure, and research at
            the intersection of interfaces and AI — with clear ownership and
            outcomes.
          </p>
        }
      />

      <div className="space-y-10 md:space-y-12">
        {caseStudies.map((study) => (
          <CaseStudyCard key={study.title} study={study} />
        ))}
      </div>
    </InnerPageShell>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-medium uppercase tracking-nav text-cobalt">
      {children}
    </h3>
  )
}

function CaseStudyCard({ study }: { study: CaseStudy }) {
  return (
    <article className="rounded-lg border-[0.5px] border-warmborder bg-surface p-6 shadow-none transition-colors hover:border-cobalt/35 hover:shadow-cobalt-glow md:p-8">
      <header className="border-b border-warmborder/80 pb-6">
        <h2 className="text-xl font-medium tracking-[-0.5px] text-[#f0e8d8] md:text-2xl">
          {study.title}
        </h2>
        {study.subtitle ? (
          <p className="mt-1 text-sm text-cobalt">{study.subtitle}</p>
        ) : null}
      </header>

      <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-ink-secondary md:text-base md:leading-[1.7]">
        <section>
          <SectionLabel>Context</SectionLabel>
          <p>{study.context}</p>
        </section>
        <section>
          <SectionLabel>Problem</SectionLabel>
          <p>{study.problem}</p>
        </section>
        <section>
          <SectionLabel>What I did</SectionLabel>
          <p className="text-[#e8e0d0]">{study.role}</p>
        </section>
        <section>
          <SectionLabel>Tech</SectionLabel>
          <ul className="flex flex-wrap gap-2">
            {study.tech.map((t) => (
              <li key={t}>
                <span className="inline-block rounded-full border-[0.5px] border-cobalt bg-transparent px-2.5 py-0.5 font-mono text-[11px] text-cobalt">
                  {t}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <SectionLabel>Outcome</SectionLabel>
          <p className="border-l-2 border-cobalt/60 pl-4 text-[#e8e0d0]">
            {study.outcome}
          </p>
        </section>
      </div>

      {study.links && study.links.length > 0 ? (
        <footer className="mt-8 flex flex-wrap gap-3 border-t border-warmborder/80 pt-6">
          {study.links.map((link) =>
            link.external ? (
              <a
                key={link.href + link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm font-medium text-cobalt transition-colors hover:text-cobalt-light"
              >
                {link.label} →
              </a>
            ) : (
              <Link
                key={link.href + link.label}
                to={link.href}
                className="inline-flex items-center text-sm font-medium text-cobalt transition-colors hover:text-cobalt-light"
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
