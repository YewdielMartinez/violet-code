/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de la API de Supabase. Local: http://127.0.0.1:54321 (ver `supabase status`). */
  readonly VITE_SUPABASE_URL: string;
  /** Llave pública (anon/publishable). Nunca la service_role en el navegador. */
  readonly VITE_SUPABASE_ANON_KEY: string;
}
