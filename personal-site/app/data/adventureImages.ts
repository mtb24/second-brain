import { adventureCategoryMeta } from './adventureCategories'

const IMAGE_GLOB_PATTERN =
  '../../public/images/adventures/**/*.{jpg,jpeg,png,gif,webp,avif,JPG,JPEG,PNG,GIF,WEBP}'

/** Discover category folders via placeholder files (empty dirs still tracked in git). */
const placeholderModules = import.meta.glob(
  '../../public/images/adventures/*/placeholder.txt',
  { eager: true },
)

const imageUrlModules = import.meta.glob<string>(IMAGE_GLOB_PATTERN, {
  eager: true,
  query: '?url',
  import: 'default',
})

const SLUG_RE = /\/images\/adventures\/([^/]+)\//

function slugFromModuleKey(key: string): string | null {
  const m = key.match(SLUG_RE)
  return m?.[1] ?? null
}

function collectSlugs(): string[] {
  const slugs = new Set<string>()

  for (const key of Object.keys(placeholderModules)) {
    const slug = slugFromModuleKey(key)
    if (slug) slugs.add(slug)
  }

  for (const key of Object.keys(imageUrlModules)) {
    const slug = slugFromModuleKey(key)
    if (slug) slugs.add(slug)
  }

  for (const slug of Object.keys(adventureCategoryMeta)) {
    slugs.add(slug)
  }

  return [...slugs]
}

function imagesForSlug(slug: string): string[] {
  return Object.entries(imageUrlModules)
    .filter(([key]) => slugFromModuleKey(key) === slug)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, url]) => url)
}

function sortSlugs(slugs: string[]): string[] {
  return [...slugs].sort((a, b) => {
    const oa = adventureCategoryMeta[a]?.order ?? 999
    const ob = adventureCategoryMeta[b]?.order ?? 999
    if (oa !== ob) return oa - ob
    return a.localeCompare(b)
  })
}

export function slugToDisplayTitle(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export type AdventureCategoryBuild = {
  slug: string
  displayTitle: string
  imageUrls: string[]
}

const slugsSorted = sortSlugs(collectSlugs())

export const adventureCategoriesBuild: AdventureCategoryBuild[] = slugsSorted.map((slug) => ({
  slug,
  displayTitle: slugToDisplayTitle(slug),
  imageUrls: imagesForSlug(slug),
}))
