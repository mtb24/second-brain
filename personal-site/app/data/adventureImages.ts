import { adventureCategoryMeta } from './adventureCategories'
import { adventureManifest } from './adventureManifest'

function collectSlugs(): string[] {
  const slugs = new Set<string>()

  for (const slug of Object.keys(adventureCategoryMeta)) {
    slugs.add(slug)
  }

  for (const slug of Object.keys(adventureManifest)) {
    slugs.add(slug)
  }

  return [...slugs]
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
  imageUrls: adventureManifest[slug] ?? [],
}))
