/**
 * Adventure carousel images live in Backblaze B2 under adventures/<slug>/.
 *
 * Filenames per category are maintained in adventureManifest.files.json (updated by
 * scripts/upload-adventure-images.sh). This module turns them into public friendly URLs.
 *
 * Set VITE_ADVENTURE_B2_BASE locally if your bucket’s friendly URL root differs.
 */
import files from './adventureManifest.files.json'

/** `${B2_BASE}/<slug>/<filename>` — matches B2 key prefix `adventures/<slug>/`. */
export const B2_BASE =
  (import.meta.env.VITE_ADVENTURE_B2_BASE as string | undefined) ||
  'https://f005.backblazeb2.com/file/kendowney-assets/adventures'

export const adventureManifest: Record<string, string[]> = Object.fromEntries(
  Object.entries(files as Record<string, string[]>).map(([slug, names]) => [
    slug,
    names.map((name) => `${B2_BASE}/${slug}/${name}`),
  ]),
)
