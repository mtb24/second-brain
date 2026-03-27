import { type FormEvent, type ReactElement } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { InnerPageShell } from '@/ui/InnerPageShell'
import { PageHeader } from '@/ui/PageHeader'

export const Route = createFileRoute('/contact')({
  component: ContactPage,
})

const LINKEDIN_URL = 'https://www.linkedin.com/in/kendowney7/'
const INSTAGRAM_URL = 'https://www.instagram.com/_._k.2_._/'
const YOUTUBE_URL =
  'https://www.youtube.com/@kensaiexperiments'

type SocialRow = {
  label: string
  href: string
  sublabel?: string
  icon: ReactElement
  external?: boolean
}

function IconGitHub() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-cobalt"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function IconYouTube() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-cobalt"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function IconLinkedIn() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-cobalt"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function IconInstagram() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-cobalt"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconEmail() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-cobalt"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M4 6h16v12H4z" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  )
}

const socialRows: SocialRow[] = [
  {
    label: 'GitHub',
    href: 'https://github.com/mtb24',
    sublabel: 'My GitHub profile',
    icon: <IconGitHub />,
  },
  {
    label: "Ken's AI Experiments",
    href: YOUTUBE_URL,
    sublabel: 'My YouTube channel for AI experiments',
    icon: <IconYouTube />,
  },
  {
    label: 'LinkedIn',
    href: LINKEDIN_URL,
    sublabel: 'My LinkedIn profile',
    icon: <IconLinkedIn />,
  },
  {
    label: 'Instagram',
    href: INSTAGRAM_URL,
    sublabel: 'My Instagram profile',
    icon: <IconInstagram />,
  },
  {
    label: 'Email',
    href: 'mailto:ken@kendowney.com',
    sublabel: 'My email address',
    icon: <IconEmail />,
    external: false,
  },
]

function ContactPage() {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
  }

  return (
    <InnerPageShell>
      <PageHeader
        kicker="Contact"
        title="Let’s build something"
        description={
          <p className="max-w-2xl">
            Reach out for collaborations, design-system work, or AI product
            engineering. Links below; a proper form is on the way.
          </p>
        }
      />

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-start">
        <div>
          <h2 className="mb-6 text-sm font-medium uppercase tracking-nav text-cobalt">
            Connect
          </h2>
          <ul className="space-y-1">
            {socialRows.map((row) => (
              <li key={row.label}>
                <a
                  href={row.href}
                  {...(row.external !== false
                    ? {
                        target: '_blank' as const,
                        rel: 'noopener noreferrer' as const,
                      }
                    : {})}
                  className="group flex items-start gap-4 rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-cobalt/30 hover:bg-surface-muted/50"
                >
                  {row.icon}
                  <span className="min-w-0">
                    <span className="block font-medium text-[#f0e8d8] transition-colors group-hover:text-cobalt-light">
                      {row.label}
                    </span>
                    {row.sublabel ? (
                      <span className="mt-0.5 block text-sm text-ink-secondary">
                        {row.sublabel}
                      </span>
                    ) : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border-[0.5px] border-warmborder bg-surface p-6 shadow-cobalt-glow md:p-8">
          <h2 className="mb-6 text-sm font-medium uppercase tracking-nav text-cobalt">
            Message
          </h2>
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                htmlFor="contact-name"
                className="mb-1.5 block text-xs font-medium uppercase tracking-nav text-ink-secondary"
              >
                Name
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                autoComplete="name"
                className="w-full rounded-md border-[0.5px] border-warmborder bg-surface-muted px-3 py-2.5 text-ink-primary placeholder:text-ink-secondary/50 outline-none transition-colors focus:border-cobalt focus:ring-1 focus:ring-cobalt"
                placeholder="Your name"
              />
            </div>
            <div>
              <label
                htmlFor="contact-email"
                className="mb-1.5 block text-xs font-medium uppercase tracking-nav text-ink-secondary"
              >
                Email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                className="w-full rounded-md border-[0.5px] border-warmborder bg-surface-muted px-3 py-2.5 text-ink-primary placeholder:text-ink-secondary/50 outline-none transition-colors focus:border-cobalt focus:ring-1 focus:ring-cobalt"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="contact-message"
                className="mb-1.5 block text-xs font-medium uppercase tracking-nav text-ink-secondary"
              >
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={5}
                className="w-full resize-y rounded-md border-[0.5px] border-warmborder bg-surface-muted px-3 py-2.5 text-ink-primary placeholder:text-ink-secondary/50 outline-none transition-colors focus:border-cobalt focus:ring-1 focus:ring-cobalt"
                placeholder="What are we working on?"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-cobalt px-5 py-3 text-sm font-medium text-[#f0e8d8] shadow-cobalt-glow transition-colors hover:bg-cobalt-light md:w-auto"
            >
              Send
            </button>
          </form>
          <p className="mt-6 border-t border-warmborder pt-6 text-sm text-ink-secondary">
            Form coming soon. Email{' '}
            <a
              href="mailto:ken@kendowney.com"
              className="font-medium text-cobalt transition-colors hover:text-cobalt-light"
            >
              ken@kendowney.com
            </a>{' '}
            directly.
          </p>
        </div>
      </div>

      <p className="mt-12 text-sm text-ink-secondary">
        <Link
          to="/resume"
          className="font-medium text-cobalt transition-colors hover:text-cobalt-light"
        >
          Resume
        </Link>
        {' · '}
        <Link
          to="/work"
          className="font-medium text-cobalt transition-colors hover:text-cobalt-light"
        >
          Work
        </Link>
      </p>
    </InnerPageShell>
  )
}
