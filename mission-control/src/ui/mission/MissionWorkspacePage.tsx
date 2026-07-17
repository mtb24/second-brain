import type { ReactNode } from 'react'

export function MissionWorkspacePage({
  eyebrow,
  title,
  question,
  children,
}: Readonly<{
  eyebrow: string
  title: string
  question: string
  children: ReactNode
}>) {
  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <div className="mission-eyebrow">{eyebrow}</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-mission-ink sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-base leading-7 text-mission-muted">{question}</p>
      </header>
      {children}
    </div>
  )
}

export function WorkspaceSourceState({
  title,
  detail,
  tone = 'neutral',
}: Readonly<{
  title: string
  detail: string
  tone?: 'neutral' | 'warning' | 'critical'
}>) {
  const toneClass =
    tone === 'critical'
      ? 'border-red-300 bg-red-50 text-red-950'
      : tone === 'warning'
        ? 'border-amber-300 bg-amber-50 text-amber-950'
        : 'border-mission-border bg-mission-surface text-mission-ink'
  return (
    <section className={`rounded-xl border p-5 ${toneClass}`} role="status">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p>
    </section>
  )
}
