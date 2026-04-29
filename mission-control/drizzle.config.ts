import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/workout/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DB_URL ?? process.env.DATABASE_URL ?? '',
  },
})
