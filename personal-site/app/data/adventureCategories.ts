/**
 * Optional metadata for adventure categories (B2 path adventures/<slug>/).
 * Categories without an entry still render (title from slug; no description).
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

export const adventureCategoryMeta: Record<string, AdventureCategoryMeta> = {
  'baja-racing': {
    description:
      'SCORE SF250, Pro Moto 50, team #527x — desert miles, checkpoints, and race fuel.',
    order: 1,
    icon: 'racing',
  },
  'gravel-cycling': {
    description: 'Long gravel routes, dust, and big-sky endurance days.',
    order: 2,
    icon: 'gravel',
  },
  prospecting: {
    description: 'Pans, creeks, and dry washes — geology as weekend sport.',
    order: 3,
    icon: 'prospect',
  },
  overlanding: {
    description: 'Self-supported trips, camp setups, and backcountry logistics.',
    order: 4,
    icon: 'overland',
  },
  'off-road-moto': {
    description: 'Single track, sand washes, and technical desert riding.',
    order: 5,
    icon: 'moto',
  },
  'outdoor-exploration': {
    description: 'Maps, peaks, and wherever the trail runs out.',
    order: 6,
    icon: 'explore',
  },
}
