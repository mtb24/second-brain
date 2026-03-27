#!/usr/bin/env node
/**
 * Merges uploaded basenames into app/data/adventureManifest.files.json for a slug.
 * Usage: node scripts/update-adventure-manifest.mjs <slug> <basename> [<basename> ...]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const siteRoot = path.join(__dirname, '..')
const jsonPath = path.join(siteRoot, 'app/data/adventureManifest.files.json')

const [slug, ...basenames] = process.argv.slice(2)
if (!slug || basenames.length === 0) {
  console.error(
    'usage: node scripts/update-adventure-manifest.mjs <slug> <basename> [<basename> ...]',
  )
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
if (!Object.prototype.hasOwnProperty.call(data, slug)) {
  data[slug] = []
}

const set = new Set(data[slug])
for (const name of basenames) {
  if (name && !name.includes('/')) set.add(name)
}
data[slug] = [...set].sort((a, b) => a.localeCompare(b))

fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.error(`Updated adventureManifest.files.json for "${slug}" (${data[slug].length} files).`)
