/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Umami website id (D-248); empty = no audience measurement. */
  readonly VITE_UMAMI_WEBSITE_ID?: string
}
