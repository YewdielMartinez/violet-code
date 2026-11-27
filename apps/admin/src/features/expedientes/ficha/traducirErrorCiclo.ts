const FALLBACK_MESSAGES = {
  archivar: 'No se pudo archivar el expediente.',
  desarchivar: 'No se pudo desarchivar el expediente.',
} as const;

const PERMISSION_MESSAGES = {
  archivar: 'No tienes permiso para archivar expedientes.',
  desarchivar: 'No tienes permiso para desarchivar expedientes.',
} as const;

/**
 * Traduce errores de `archivar_ficha` y `reabrir_ficha` conservando los mensajes de regla de
 * negocio (`23514`) que devuelve la RPC y traduciendo códigos técnicos (`42501`, `PGRST202`).
 */
export function traducirErrorCicloExpediente(
  err: unknown,
  accion: 'archivar' | 'desarchivar',
): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string'
      ? err.code
      : '';
  const message =
    typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string'
      ? err.message.trim()
      : '';

  if (code === 'PGRST202') {
    return 'El servidor no está actualizado; avisa a soporte.';
  }
  if (code === '42501') {
    return PERMISSION_MESSAGES[accion];
  }
  if (message) {
    return message;
  }
  return FALLBACK_MESSAGES[accion];
}
