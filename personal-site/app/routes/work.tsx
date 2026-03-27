import { createFileRoute, Link } from '@tanstack/react-router'
import { InnerPageShell } from '@/ui/InnerPageShell'
import { PageHeader } from '@/ui/PageHeader'

export const Route = createFileRoute('/work')({
  component: WorkPage,
})

type Project = {
  name: string
  description: string
  tags: readonly string[]
  href: string
  external?: boolean
}

const projects: Project[] = [
  {
    name: 'Second Brain',
    description:
      'Personal OS with autonomous AI agents, tournament system, and Mission Control dashboard.',
    tags: [
      'TypeScript',
      'Python',
      'FastAPI',
      'Postgres',
      'OpenClaw',
      'TanStack Start',
    ],
    href: 'https://mission.kendowney.com',
    external: true,
  },
  {
    name: 'Design System Contract Layer',
    description:
      'AI-generated UI validation against design system constraints.',
    tags: ['React', 'TypeScript'],
    href: 'https://github.com/mtb24',
    external: true,
  },
  {
    name: 'City of Portland Component Library',
    description:
      'Production design system packages: @cityofportland/component-library, @cityofportland/design-tokens.',
    tags: ['React', 'TypeScript', 'Storybook'],
    href: 'https://www.npmjs.com/search?q=scope%3Acityofportland',
    external: true,
  },
  {
    name: 'Honest Fit Assessment',
    description:
      'AI-powered job fit analysis — hybrid deterministic + LLM reasoning.',
    tags: ['AI', 'Product'],
    href: '/honest-fit',
  },
  {
    name: 'Trading Tournament',
    description:
      'Crypto strategy evolution with Claude-powered bots and shared market simulation.',
    tags: ['TypeScript', 'Claude API', 'Postgres'],
    href: 'https://mission.kendowney.com/trading',
    external: true,
  },
  {
    name: "Ken's AI Experiments",
    description:
      'YouTube channel on AI engineering and design system governance.',
    tags: ['Video', 'Education'],
    href: 'https://www.youtube.com/results?search_query=Ken%27s+AI+Experiments',
    external: true,
  },
]

function WorkPage() {
  return (
    <InnerPageShell>
      <PageHeader
        kicker="Work"
        title="Projects & experiments"
        description={
          <p>
            A mix of production systems, public design infrastructure, and side
            quests at the edge of interfaces and AI.
          </p>
        }
      />

      <ul className="grid gap-6 md:grid-cols-2">
        {projects.map((p) => (
          <li key={p.name}>
            <ProjectCard {...p} />
          </li>
        ))}
      </ul>
    </InnerPageShell>
  )
}

function ProjectCard({
  name,
  description,
  tags,
  href,
  external,
}: Readonly<Project>) {
  const className =
    'group flex h-full flex-col rounded-lg border-[0.5px] border-warmborder bg-surface p-6 transition-colors hover:border-cobalt/40 hover:shadow-cobalt-glow'

  const inner = (
    <>
      <h2 className="text-lg font-medium tracking-[-0.5px] text-[#f0e8d8] group-hover:text-cobalt-light">
        {name}
      </h2>
      <p className="mt-2 flex-1 text-ink-secondary">{description}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {tags.map((t) => (
          <li key={t}>
            <span className="inline-block rounded-full border-[0.5px] border-cobalt bg-transparent px-2.5 py-0.5 font-mono text-[11px] text-cobalt">
              {t}
            </span>
          </li>
        ))}
      </ul>
      <span className="mt-4 text-sm font-medium text-cobalt transition-colors group-hover:text-cobalt-light">
        {external ? 'Open link →' : 'View →'}
      </span>
    </>
  )

  if (external) {
    return (
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {inner}
      </a>
    )
  }

  return (
    <Link to={href} className={className}>
      {inner}
    </Link>
  )
}
