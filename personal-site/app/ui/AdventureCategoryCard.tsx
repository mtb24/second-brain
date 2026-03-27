import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const AUTO_ADVANCE_MS = 4000

function useInView<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>
  inView: boolean
} {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const io = new IntersectionObserver(
      (entries) => {
        setInView(entries.some((e) => e.isIntersecting))
      },
      { rootMargin: '140px', threshold: 0.02 },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [])

  return { ref, inView }
}

type AdventureCategoryCardProps = {
  title: string
  description?: string
  /** Absolute URLs (e.g. B2 friendly URLs from adventureManifest). */
  imageUrls: string[]
  placeholder: ReactNode
}

export function AdventureCategoryCard({
  title,
  description,
  imageUrls,
  placeholder,
}: AdventureCategoryCardProps) {
  const hasImages = imageUrls.length > 0
  const { ref, inView } = useInView<HTMLDivElement>()
  const [index, setIndex] = useState(0)
  const [hoverPaused, setHoverPaused] = useState(false)

  const len = imageUrls.length
  const safeIndex = len > 0 ? index % len : 0

  const go = useCallback(
    (delta: number) => {
      if (!len) return
      setIndex((i) => (i + delta + len) % len)
    },
    [len],
  )

  useEffect(() => {
    if (!hasImages || len <= 1 || !inView || hoverPaused) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % len)
    }, AUTO_ADVANCE_MS)
    return () => window.clearInterval(id)
  }, [hasImages, len, inView, hoverPaused])

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border-[0.5px] border-warmborder bg-surface transition-colors hover:border-cobalt/35 hover:shadow-cobalt-glow">
      <div
        ref={ref}
        className="group relative aspect-[16/10] bg-gradient-to-br from-surface-muted via-[#252018] to-void-deep"
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
        aria-label={hasImages ? `${title} photo carousel` : `${title} placeholder`}
      >
        {!hasImages ? (
          <div
            className="relative flex h-full w-full items-center justify-center"
            aria-hidden
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(0,71,171,0.12),transparent_50%)]" />
            {placeholder}
          </div>
        ) : (
          <>
            <div className="absolute inset-0 overflow-hidden">
              {imageUrls.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  width={1600}
                  height={1000}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms] ease-out"
                  style={{
                    opacity: i === safeIndex ? 1 : 0,
                    zIndex: i === safeIndex ? 1 : 0,
                  }}
                />
              ))}
            </div>
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(0,71,171,0.08),transparent_55%)]"
              aria-hidden
            />
            {len > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="pointer-events-auto absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-warmborder/60 bg-void-deep/75 text-[#f0e8d8] opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-200 hover:border-cobalt/40 hover:text-cobalt-light group-hover:opacity-100 md:left-3"
                  aria-label={`Previous ${title} photo`}
                >
                  <ChevronIcon dir="left" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="pointer-events-auto absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-warmborder/60 bg-void-deep/75 text-[#f0e8d8] opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-200 hover:border-cobalt/40 hover:text-cobalt-light group-hover:opacity-100 md:right-3"
                  aria-label={`Next ${title} photo`}
                >
                  <ChevronIcon dir="right" />
                </button>
              </>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h2 className="text-lg font-medium tracking-[-0.5px] text-[#f0e8d8]">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 flex-1 text-sm text-ink-secondary">{description}</p>
        ) : null}
      </div>
    </article>
  )
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {dir === 'left' ? (
        <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}
