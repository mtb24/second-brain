import type { ReactNode } from 'react'

export type PageHeaderProps = {
  /** Small uppercase label above the title (e.g. "Work") */
  kicker?: string
  title: string
  /** Intro copy below the title */
  description?: ReactNode
}

/**
 * Shared heading block for inner pages — warm off-white title, muted secondary text.
 */
export function PageHeader({ kicker, title, description }: PageHeaderProps) {
  return (
    <header className="mb-12 max-w-2xl space-y-4">
      {kicker ? (
        <p className="text-xs font-medium uppercase tracking-nav text-ink-secondary">
          {kicker}
        </p>
      ) : null}
      <h1 className="text-3xl font-medium tracking-[-0.5px] text-ink-primary md:text-4xl">
        {title}
      </h1>
      {description ? (
        <div className="text-ink-secondary">{description}</div>
      ) : null}
    </header>
  )
}
