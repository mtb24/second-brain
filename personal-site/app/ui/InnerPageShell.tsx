import type { ReactNode } from 'react'

type InnerPageShellProps = {
  children: ReactNode
}

/**
 * Consistent outer layout for all inner pages: clears fixed nav + horizontal rhythm.
 */
export function InnerPageShell({ children }: InnerPageShellProps) {
  return (
    <main className="border-t border-warmborder">
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-16 md:pb-20">
        {children}
      </div>
    </main>
  )
}
