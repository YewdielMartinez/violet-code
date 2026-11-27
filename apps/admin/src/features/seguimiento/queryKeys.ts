/** Raíz de las consultas de la línea de tiempo: invalidarla refresca la de cualquier expediente. */
export const LINEA_TIEMPO_QUERY_ROOT = ['seguimiento', 'linea-tiempo'] as const;

export function lineaTiempoQueryKey(fichaId: string) {
  return [...LINEA_TIEMPO_QUERY_ROOT, fichaId] as const;
}
