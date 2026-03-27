#!/usr/bin/env node
/**
 * Writes app/data/adventureManifest.files.json from the local adventure staging tree.
 *
 * Each immediate subdirectory of the staging root is a category key (slug).
 * Image files are collected recursively; paths are POSIX-style relative to that category
 * (e.g. subdir/photo.jpg → stored as "subdir/photo.jpg" for B2 keys adventures/<slug>/subdir/photo.jpg).
 *
 * Env:
 *   ADVENTURE_STAGING_ROOT — override default ~/Sites/kendowney.com/images/adventures
 *
 * Usage: node scripts/generate-adventure-manifest.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const siteRoot = path.join(__dirname, '..')
const jsonPath = path.join(siteRoot, 'app/data/adventureManifest.files.json')

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

function isImageBasename(name) {
  return IMAGE_EXT.has(path.extname(name).toLowerCase())
}

/** @param {string} dir @param {string} categoryRoot */
function collectImages(dir, categoryRoot) {
  /** @type {string[]} */
  const out = []
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...collectImages(full, categoryRoot))
    } else if (e.isFile() && isImageBasename(e.name)) {
      out.push(path.relative(categoryRoot, full).split(path.sep).join('/'))
    }
  }
  return out
}

function defaultStagingRoot() {
  const home = process.env.HOME || ''
  return path.join(home, 'Sites', 'kendowney.com', 'images', 'adventures')
}

const stagingRoot = process.env.ADVENTURE_STAGING_ROOT
  ? path.resolve(process.env.ADVENTURE_STAGING_ROOT)
  : defaultStagingRoot()

if (!fs.existsSync(stagingRoot)) {
  console.error(`error: staging directory does not exist: ${stagingRoot}`)
  console.error('Create it or set ADVENTURE_STAGING_ROOT.')
  process.exit(1)
}

if (!fs.statSync(stagingRoot).isDirectory()) {
  console.error(`error: not a directory: ${stagingRoot}`)
  process.exit(1)
}

/** @type {Record<string, string[]>} */
const data = {}

const categories = fs
  .readdirSync(stagingRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  // ignore hidden dirs (e.g. .vscode)
  .filter((name) => !name.startsWith('.'))
  .sort((a, b) => a.localeCompare(b))

for (const slug of categories) {
  const catDir = path.join(stagingRoot, slug)
  const files = collectImages(catDir, catDir)
  files.sort((a, b) => a.localeCompare(b))
  data[slug] = files
}

fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
console.error(
  `Wrote ${path.relative(siteRoot, jsonPath)} (${categories.length} categories, ${Object.values(data).reduce((n, a) => n + a.length, 0)} files).`,
)
