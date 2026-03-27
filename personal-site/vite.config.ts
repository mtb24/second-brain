import path from 'node:path'
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: { port: 4174 },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'app'),
    },
  },
  plugins: [
    tsconfigPaths(),
    tanstackStart({ srcDirectory: 'app' }),
    nitroV2Plugin({ preset: 'node-server' }),
    react(),
  ],
})
