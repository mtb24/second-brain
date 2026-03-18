import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin'
import react from '@vitejs/plugin-react'
import path from 'path'
export default defineConfig({
  server: { port: 4173 },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'app': path.resolve(__dirname, 'app'),
    },
  },
  plugins: [
    tanstackStart(),
    nitroV2Plugin({ preset: 'node-server' }),
    react(),
  ],
})
