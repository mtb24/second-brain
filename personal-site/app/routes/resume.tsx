import { createFileRoute, Link } from '@tanstack/react-router'
import { experience, resumeSkillGroups, siteHeadline } from '@/data/kenProfile'
import { InnerPageShell } from '@/ui/InnerPageShell'
import { PageHeader } from '@/ui/PageHeader'

export const Route = createFileRoute('/resume')({
  component: ResumePage,
})

const skillSectionOrder = [
  { key: 'frontend', label: 'Frontend' },
  { key: 'designSystems', label: 'Design systems' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'backendAndApis', label: 'Backend & APIs' },
  { key: 'aiTools', label: 'AI tools' },
  { key: 'testing', label: 'Testing' },
  { key: 'infrastructureAndOps', label: 'Infrastructure & ops' },
] as const

function formatRange(start: string, end: string | null) {
  return `${start} – ${end ?? 'Present'}`
}

function TechPills({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <span className="inline-block rounded-full border border-cobalt bg-transparent px-3 py-1 text-sm text-ink-primary">
            {item}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ResumePage() {
  return (
    <InnerPageShell>
      <PageHeader
        kicker="Resume"
        title="Experience & skills"
        description={
          <div className="max-w-2xl space-y-3">
            <p className="text-[15px] font-medium text-[#e8e0d0] md:text-base">
              {siteHeadline}
            </p>
            <p className="text-ink-secondary">
              Frontend and design-system leadership across public sector,
              fintech, insurance, and ecommerce — with growing depth in
              AI-enabled interfaces and agentic systems.
            </p>
          </div>
        }
      />

      <div className="mb-16 space-y-10">
        <h2 className="text-sm font-medium uppercase tracking-nav text-cobalt">
          Skills
        </h2>
        <div className="grid gap-10 md:grid-cols-2">
          {skillSectionOrder.map(({ key, label }) => {
            const items = resumeSkillGroups[key]
            if (!items?.length) return null
            return (
              <div key={key}>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-nav text-ink-secondary">
                  {label}
                </h3>
                <TechPills items={items} />
              </div>
            )
          })}
        </div>
      </div>

      <div className="mb-14 space-y-10">
        <h2 className="text-sm font-medium uppercase tracking-nav text-cobalt">
          Experience
        </h2>
        <div className="relative">
          <div
            className="absolute bottom-2 left-[7px] top-2 w-px bg-warmborder md:left-[9px]"
            aria-hidden
          />
          <ul className="relative space-y-0">
            {experience.map((job) => (
              <li
                key={`${job.company}-${job.role}-${job.start}`}
                className="relative pb-12 pl-10 md:pb-14 md:pl-12"
              >
                <span
                  className="absolute left-0 top-2 h-3 w-3 rounded-full bg-cobalt ring-4 ring-void md:top-2.5"
                  aria-hidden
                />
                <div className="space-y-4">
                  <div>
                    <p className="text-lg font-medium tracking-[-0.5px] text-[#f0e8d8]">
                      {job.role}
                    </p>
                    <p className="mt-1 text-cobalt-light">{job.company}</p>
                    <p className="mt-1 text-sm text-ink-secondary">
                      {formatRange(job.start, job.end)}
                      {job.location ? ` · ${job.location}` : ''}
                    </p>
                    {job.domain ? (
                      <p className="mt-3 text-xs font-medium uppercase tracking-nav text-cobalt/90">
                        {job.domain}
                      </p>
                    ) : null}
                  </div>
                  <TechPills items={job.stack} />
                  <ul className="list-disc space-y-2 pl-5 text-ink-secondary">
                    {job.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                  {job.links && job.links.length > 0 ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                      {job.links.map((link) => (
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
                    </div>
                  ) : null}
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
