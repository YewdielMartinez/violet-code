export interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

export class SupabaseRpcError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string | null) {
    super(message);
    this.name = 'SupabaseRpcError';
    if (code) {
      this.code = code;
    }
  }
}

const DEFAULT_ERROR_MESSAGE = 'No se pudo completar la operación. Intenta de nuevo.';

const FIXED_CODE_MESSAGES: Record<string, string> = {
  '42501': 'No tienes permiso para realizar esta acción.',
  '40001': 'Conflicto de concurrencia. Recarga los datos e intenta de nuevo.',
  '23503': 'Un dato seleccionado ya no existe. Recarga e intenta de nuevo.',
  PGRST116: 'No se encontró el registro.',
  PGRST202: 'No se pudo completar la operación.',
  PGRST203: 'No se pudo completar la operación.',
  PGRST301: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  PGRST303: 'Tu sesión expiró. Vuelve a iniciar sesión.',
};

/**
 * Traduce errores de Postgres, RLS y PostgREST (`supabase-js`) a `Error` con
 * mensajes en español listos para la UI, según `api/errores.md`.
 */
export function mapSupabaseError(
  error: PostgrestLikeError,
  defaultMessage = DEFAULT_ERROR_MESSAGE,
): SupabaseRpcError {
  const code = error.code ?? undefined;
  const businessMessage = error.message?.trim();

  if (code === '23514' || code === 'P0001') {
    return new SupabaseRpcError(
      businessMessage || 'La operación no cumple las reglas de negocio.',
      code,
    );
  }

  if (code === '23505') {
    return new SupabaseRpcError(
      businessMessage || 'Este registro ya existe o fue modificado por otra persona.',
      code,
    );
  }

  if (code && code in FIXED_CODE_MESSAGES) {
    return new SupabaseRpcError(FIXED_CODE_MESSAGES[code], code);
  }

  return new SupabaseRpcError(defaultMessage, code);
}
