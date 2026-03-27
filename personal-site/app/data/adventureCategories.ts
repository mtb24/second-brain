/**
 * Optional metadata for adventure categories (B2 path adventures/<slug>/).
 * Slugs must match folder names under ~/Sites/kendowney.com/images/adventures/ (staging)
 * and under /home/brain/adventure-images/adventures/ on the VPS (Nginx static).
 * (and keys in adventureManifest.files.json). Categories without an entry still
 * render (title from slug; no description).
 */
export type AdventureIconKey =
  | 'racing'
  | 'gravel'
  | 'prospect'
  | 'overland'
  | 'moto'
  | 'explore'

export type AdventureCategoryMeta = {
  description?: string
  order?: number
  icon?: AdventureIconKey
}

/** Keys align with staging / B2 folder names (e.g. cycling/, off-road-moto/, outdoors/). */
export const adventureCategoryMeta: Record<string, AdventureCategoryMeta> = {
  cycling: {
    description: 'Long miles, dirt roads, and big-sky saddle time.',
    order: 1,
    icon: 'gravel',
  },
  'off-road-moto': {
    description: 'Single track, sand washes, and technical desert riding.',
    order: 2,
    icon: 'moto',
  },
  outdoors: {
    description: 'Maps, peaks, coastlines, and wherever the trail runs out.',
    order: 3,
    icon: 'explore',
  },
}
