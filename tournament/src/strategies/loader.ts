import * as fs from 'fs/promises'
import * as path from 'path'
import { Strategy } from '../bot/types.js'

const SEED_DIR = path.join(__dirname, 'seed')

function parseName(doc: string, fallback: string): string {
  const match = doc.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : fallback
}

function parseTier(doc: string): Strategy['tier'] {
  const lower = doc.toLowerCase()
  if (lower.includes('conservative')) return 'conservative'
  if (lower.includes('aggressive')) return 'aggressive'
  return 'balanced'
}

export async function loadStrategyFromFile(filename: string): Promise<Strategy> {
  const filePath = path.isAbsolute(filename)
    ? filename
    : path.join(SEED_DIR, filename)

  let doc: string
  try {
    doc = await fs.readFile(filePath, 'utf-8')
  } catch (err) {
    throw new Error(`Failed to load strategy from ${filePath}: ${err}`)
  }

  const basename = path.basename(filename, path.extname(filename))

  return {
    id: basename,
    name: parseName(doc, basename),
    generation: 0,
    tier: parseTier(doc),
    status: 'approved',
    source: 'manual',
    parentIds: [],
    doc,
    createdAt: new Date(),
  }
}

export async function loadSeedStrategies(): Promise<Strategy[]> {
  let files: string[]
  try {
    files = await fs.readdir(SEED_DIR)
  } catch (err) {
    throw new Error(`Failed to read seed directory ${SEED_DIR}: ${err}`)
  }

  const mdFiles = files.filter((f) => f.endsWith('.md'))
  const strategies: Strategy[] = []

  for (const file of mdFiles) {
    try {
      const strategy = await loadStrategyFromFile(path.join(SEED_DIR, file))
      strategies.push(strategy)
    } catch (err) {
      console.error(`[loader] Skipping ${file}:`, err)
    }
  }

  return strategies
}
