/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Google OAuth client ID for "Sign in with Google". Optional — when unset the
   * button hides itself. Must be VITE_-prefixed so Vite exposes it to the client.
   */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
