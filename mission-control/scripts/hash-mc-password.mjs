#!/usr/bin/env node
/**
 * Generate MC_PASSWORD_HASH for Mission Control .env
 *
 * Usage:
 *   node scripts/hash-mc-password.mjs 'yourpassword'
 *
 * Or (from repo root, workspace):
 *   npm run hash-mc-password --workspace=mission-control -- 'yourpassword'
 */
import bcrypt from 'bcryptjs'

const pwd = process.argv[2]
if (!pwd) {
  console.error('Usage: node scripts/hash-mc-password.mjs <password>')
  process.exit(1)
}

const hash = await bcrypt.hash(pwd, 10)
console.log(hash)
