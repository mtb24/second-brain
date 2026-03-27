/**
 * Adventure carousel images are served from the same origin at
 * `/images/adventures/<slug>/…` (Nginx `alias` → `/home/brain/adventure-images/adventures/`;
 * see BRAIN.md). Filenames per category live in adventureManifest.files.json
 * (updated by `npm run sync-adventures` or the adventure-photo OpenClaw skill).
 *
 * Optional: `VITE_ADVENTURE_IMAGE_BASE` for dev/proxy overrides (must be a path or origin URL prefix).
 */
import files from './adventureManifest.files.json'

/** Base path or URL prefix before `/<slug>/<filename>`. */
export const IMAGE_BASE =
  (import.meta.env.VITE_ADVENTURE_IMAGE_BASE as string | undefined) || '/images/adventures'

/** Path segments must be encoded (spaces, parentheses, etc.). */
function adventureImageUrl(slug: string, relativePath: string): string {
  const encodedSlug = encodeURIComponent(slug)
  const encodedPath = relativePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  const base = IMAGE_BASE.replace(/\/$/, '')
  return `${base}/${encodedSlug}/${encodedPath}`
}

export const adventureManifest: Record<string, string[]> = Object.fromEntries(
  Object.entries(files as Record<string, string[]>).map(([slug, names]) => [
    slug,
    names.map((name) => adventureImageUrl(slug, name)),
  ]),
)
