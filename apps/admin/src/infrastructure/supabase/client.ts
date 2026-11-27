import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Cliente único de Supabase para el panel.
 * Solo los adaptadores de `infrastructure/supabase/adapters/` deben importarlo;
 * `domain/`, `hooks/` y `features/` trabajan contra los puertos.
 * La seguridad la aplican las políticas RLS de `supabase/migrations/`: aquí solo va la llave pública.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const isPlaceholderKey =
  !anonKey || anonKey.endsWith('...') || anonKey === 'tu_anon_key_aqui';

if (!url || isPlaceholderKey) {
  throw new Error(
    'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY reales en apps/admin/.env (o .env.local). ' +
      'Obtén la llave pública (anon / publishable) desde Project Settings > API Keys en Supabase o con `npx supabase status`.',
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

/**
 * Cliente efímero SIN sesión persistida, para dar de alta cuentas de Auth (`signUp`) desde el panel sin
 * reemplazar la sesión de quien administra. Usa otra `storageKey` para no tocar la sesión del cliente principal.
 * Los perfiles (`empleado` / `usuario_externo`) se escriben siempre con el cliente principal (RLS `cuentas.gestionar`).
 */
export function createIsolatedAuthClient() {
  return createClient<Database>(url as string, anonKey as string, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'vc-alta-cuenta',
    },
  });
}
