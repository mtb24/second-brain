import { createFileRoute, Link } from '@tanstack/react-router'
import { InnerPageShell } from '@/ui/InnerPageShell'
import { PageHeader } from '@/ui/PageHeader'

export const Route = createFileRoute('/resume')({
  component: ResumePage,
})

const skillGroups: { label: string; items: readonly string[] }[] = [
  {
    label: 'Frontend',
    items: [
      'React',
      'TypeScript',
      'Next.js',
      'TanStack Start',
      'Tailwind CSS',
    ],
  },
  {
    label: 'Design Systems',
    items: ['Storybook', 'Design Tokens', 'Component Libraries'],
  },
  {
    label: 'AI/ML',
    items: ['Claude API', 'LLM Integration', 'AI Agents', 'OpenClaw'],
  },
  {
    label: 'Infrastructure',
    items: ['Docker', 'Nginx', 'Postgres', 'DigitalOcean', 'GitHub Actions'],
  },
]

const experience: {
  title: string
  company: string
  body: string
}[] = [
  {
    title: 'Senior Frontend Engineer',
    company: 'ICF (City of Portland)',
    body: 'Published @cityofportland/component-library and @cityofportland/design-tokens. Led design system architecture for city government digital services.',
  },
  {
    title: 'Senior Frontend Engineer',
    company: 'Headlands Ventures',
    body: 'Built frontend architecture for venture-backed products.',
  },
  {
    title: 'Frontend Engineer',
    company: 'Talage',
    body: 'Insurance tech platform frontend development.',
  },
  {
    title: 'Frontend Engineer',
    company: 'Clear Capital',
    body: 'Real estate analytics platform.',
  },
  {
    title: 'UX Engineer',
    company: 'frog',
    body: 'Design and technology consultancy. Enterprise UX engineering.',
  },
]

function ResumePage() {
  return (
    <InnerPageShell>
      <PageHeader
        kicker="Resume"
        title="Experience & skills"
        description={
          <p className="max-w-2xl">
            Frontend and design-system leadership across public sector, startups,
            and enterprise — with a growing focus on AI-enabled interfaces and
            agentic systems.
          </p>
        }
      />

      <div className="mb-16 space-y-10">
        <h2 className="text-sm font-medium uppercase tracking-nav text-cobalt">
          Skills
        </h2>
        <div className="grid gap-10 md:grid-cols-2">
          {skillGroups.map((group) => (
            <div key={group.label}>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-nav text-ink-secondary">
                {group.label}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <li key={item}>
                    <span className="inline-block rounded-full border border-cobalt bg-transparent px-3 py-1 text-sm text-ink-primary">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-14 space-y-10">
        <h2 className="text-sm font-medium uppercase tracking-nav text-cobalt">
          Experience
        </h2>
        <div className="relative">
          <div
            className="absolute left-[7px] top-2 bottom-2 w-px bg-warmborder md:left-[9px]"
            aria-hidden
          />
          <ul className="relative space-y-0">
            {experience.map((job) => (
              <li
                key={`${job.company}-${job.title}`}
                className="relative pb-12 pl-10 md:pb-14 md:pl-12"
              >
                <span
                  className="absolute left-0 top-2 h-3 w-3 rounded-full bg-cobalt ring-4 ring-void md:top-2.5"
                  aria-hidden
                />
                <div className="space-y-2">
                  <p className="text-lg font-medium tracking-[-0.5px] text-[#f0e8d8]">
                    {job.title}
                    <span className="text-ink-secondary"> — </span>
                    <span className="text-cobalt-light">{job.company}</span>
                  </p>
                  <p className="max-w-2xl text-ink-secondary">{job.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-warmborder pt-10">
        <a
          href="/resume.pdf"
          className="inline-flex items-center justify-center rounded-lg border border-cobalt bg-transparent px-5 py-2.5 text-sm font-medium text-cobalt transition-colors hover:border-cobalt-light hover:bg-cobalt/10 hover:text-cobalt-light"
        >
          Download resume
        </a>
      </div>

      <p className="mt-8 text-sm text-ink-secondary">
        <Link
          to="/contact"
          className="font-medium text-cobalt transition-colors hover:text-cobalt-light"
        >
          Get in touch
        </Link>
        {' · '}
        <Link
          to="/work"
          className="font-medium text-cobalt transition-colors hover:text-cobalt-light"
        >
          View work
        </Link>
      </p>
    </InnerPageShell>
  )
}
