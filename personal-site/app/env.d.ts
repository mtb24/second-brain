/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override adventure image URL prefix (default `/images/adventures`). */
  readonly VITE_ADVENTURE_IMAGE_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
