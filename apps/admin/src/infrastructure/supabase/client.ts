import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Cliente único de Supabase para el panel.
 * Solo los adaptadores de `infrastructure/supabase/adapters/` deben importarlo;
 * `domain/`, `hooks/` y `features/` trabajan contra los puertos.
 * La seguridad la aplican las políticas RLS de `supabase/migrations/`: aquí solo va la llave pública.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copia apps/admin/.env.example a apps/admin/.env.local ' +
      'y llena los valores de `npx supabase status`.',
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type SupabaseClient = typeof supabase;
