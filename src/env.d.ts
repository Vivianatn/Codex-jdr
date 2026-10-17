/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Umami website id (D-248); empty = no audience measurement. */
  readonly VITE_UMAMI_WEBSITE_ID?: string
}

/** Version of Codex from package.json, set at build time (vite.config.ts, D-271). */
declare const __CODEX_VERSION__: string
