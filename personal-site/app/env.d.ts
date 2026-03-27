/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override B2 friendly URL root for adventure images (see adventureManifest.ts). */
  readonly VITE_ADVENTURE_B2_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
