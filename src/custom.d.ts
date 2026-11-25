interface ImportMetaEnv {
  readonly VITE_PUBLICSUPABASE_URL?: string;
  readonly VITE_PUBLICSUPABASE_ANON_KEY?: string;
  readonly VITE_PUBLICSUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
