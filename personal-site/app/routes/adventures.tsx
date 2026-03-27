import { type ReactElement } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  adventureCategoryMeta,
  type AdventureIconKey,
} from '@/data/adventureCategories'
import { adventureCategoriesBuild } from '@/data/adventureImages'
import { InnerPageShell } from '@/ui/InnerPageShell'
import { AdventureCategoryCard } from '@/ui/AdventureCategoryCard'
import { PageHeader } from '@/ui/PageHeader'

export const Route = createFileRoute('/adventures')({
  component: AdventuresPage,
})

const INSTAGRAM_URL = 'https://www.instagram.com/_._k.2_._/'

function IconRacing() {
  return (
    <svg
      className="h-14 w-14 text-cobalt/90"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M8 44h48M14 44l8-24h20l8 24M22 20l4-8h12l4 8" />
      <circle cx="20" cy="44" r="6" />
      <circle cx="44" cy="44" r="6" />
    </svg>
  )
}

function IconGravel() {
  return (
    <svg
      className="h-14 w-14 text-cobalt/90"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="32" cy="38" r="14" />
      <path d="M32 24v-8M22 18l6 4M42 18l-6 4" />
      <path d="M18 46l-6 6M46 46l6 6" strokeLinecap="round" />
    </svg>
  )
}

function IconProspect() {
  return (
    <svg
      className="h-14 w-14 text-cobalt/90"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M32 8L12 48h40L32 8z" />
      <circle cx="32" cy="36" r="6" fill="currentColor" opacity="0.35" stroke="none" />
    </svg>
  )
}

function IconOverland() {
  return (
    <svg
      className="h-14 w-14 text-cobalt/90"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M8 40h48v8H8zM12 40V28h16l8-12h16v24" />
      <path d="M20 40v-8h8v8M44 28v12" />
    </svg>
  )
}

function IconMoto() {
  return (
    <svg
      className="h-14 w-14 text-cobalt/90"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="18" cy="44" r="8" />
      <circle cx="48" cy="44" r="8" />
      <path d="M26 44h12M32 20l-6 24M32 20l14 8-4 16" />
    </svg>
  )
}

function IconExplore() {
  return (
    <svg
      className="h-14 w-14 text-cobalt/90"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="32" cy="32" r="22" />
      <path d="M32 18v28M22 32h20" strokeLinecap="round" />
      <polygon
        points="32,14 36,24 32,22 28,24"
        fill="currentColor"
        stroke="none"
        opacity="0.6"
      />
    </svg>
  )
}

const iconByKey: Record<AdventureIconKey, ReactElement> = {
  racing: <IconRacing />,
  gravel: <IconGravel />,
  prospect: <IconProspect />,
  overland: <IconOverland />,
  moto: <IconMoto />,
  explore: <IconExplore />,
}

function placeholderForSlug(slug: string): ReactElement {
  const key = adventureCategoryMeta[slug]?.icon ?? 'explore'
  return iconByKey[key]
}

function AdventuresPage() {
  return (
    <InnerPageShell>
      <PageHeader
        kicker="Adventures"
        title="Outside the editor"
        description={
          <p className="max-w-2xl">
            Desert, dirt, and distance. Photos are served from a public Backblaze B2
            bucket; URLs are listed in{' '}
            <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-ink-secondary">
              app/data/adventureManifest.files.json
            </code>{' '}
            (use{' '}
            <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-ink-secondary">
              scripts/upload-adventure-images.sh
            </code>{' '}
            to upload and update the manifest).
          </p>
        }
      />

      <ul className="grid gap-6 md:grid-cols-2">
        {adventureCategoriesBuild.map((cat) => (
          <li key={cat.slug}>
            <AdventureCategoryCard
              title={cat.displayTitle}
              description={adventureCategoryMeta[cat.slug]?.description}
              imageUrls={cat.imageUrls}
              placeholder={placeholderForSlug(cat.slug)}
            />
          </li>
        ))}
      </ul>

      <footer className="mt-16 border-t border-warmborder pt-10 text-center md:text-left">
        <p className="text-ink-secondary">
          Follow the adventures on{' '}
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-cobalt transition-colors hover:text-cobalt-light"
          >
            Instagram
          </a>
        </p>
        <p className="mt-6 text-sm text-ink-secondary">
          <Link
            to="/"
            className="font-medium text-cobalt transition-colors hover:text-cobalt-light"
          >
            Home
          </Link>
          {' · '}
          <Link
            to="/contact"
            className="font-medium text-cobalt transition-colors hover:text-cobalt-light"
          >
            Contact
          </Link>
        </p>
      </footer>
    </InnerPageShell>
  )
}
