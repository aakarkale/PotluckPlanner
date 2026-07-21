/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** RPC function-name prefix; `potluck_` when colocated in a shared project. */
  readonly VITE_RPC_PREFIX?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
