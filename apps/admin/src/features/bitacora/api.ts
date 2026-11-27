import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import type { BitacoraEvento, BitacoraFiltros } from '@/domain/models/Bitacora';
import { supabaseBitacoraRepository } from '@/infrastructure/supabase/adapters/SupabaseBitacoraRepository';
import { BITACORA_EXPORT_MAX, BITACORA_PAGE_SIZE } from './bitacoraList';

export * from '@/domain/models/Bitacora';

const BASE_KEY = ['bitacora'] as const;
const EXPORT_CHUNK = 200;

export function bitacoraQueryOptions(filtros: BitacoraFiltros, pagina: number) {
  return queryOptions({
    queryKey: [...BASE_KEY, 'lista', filtros.tabla, filtros.accion, filtros.desde, filtros.hasta, pagina] as const,
    queryFn: () =>
      supabaseBitacoraRepository.listar({ ...filtros, limite: BITACORA_PAGE_SIZE, offset: (pagina - 1) * BITACORA_PAGE_SIZE }),
    // La bitácora crece sin parar: se muestra la página anterior mientras llega la nueva.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** `filtros = null`: rango de fechas inválido, no se consulta. */
export function useBitacora(filtros: BitacoraFiltros | null, pagina: number, enabled = true) {
  const options = bitacoraQueryOptions(filtros ?? { tabla: null, accion: null, desde: null, hasta: null }, pagina);
  return useQuery({ ...options, enabled: enabled && filtros !== null });
}

export function useBitacoraOpciones(enabled = true) {
  return useQuery({
    queryKey: [...BASE_KEY, 'opciones'] as const,
    queryFn: () => supabaseBitacoraRepository.opcionesFiltro(),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export interface BitacoraExportacion {
  eventos: BitacoraEvento[];
  total: number;
  /** `true` si hay más eventos que el tope de la descarga (`BITACORA_EXPORT_MAX`). */
  truncado: boolean;
}

/** Trae los eventos que cumplen los filtros (hasta el tope) en trozos de 200 para la descarga CSV / Excel. */
export async function obtenerBitacoraParaExportar(filtros: BitacoraFiltros): Promise<BitacoraExportacion> {
  const eventos: BitacoraEvento[] = [];
  let total = 0;
  while (eventos.length < BITACORA_EXPORT_MAX) {
    const limite = Math.min(EXPORT_CHUNK, BITACORA_EXPORT_MAX - eventos.length);
    const pagina = await supabaseBitacoraRepository.listar({ ...filtros, limite, offset: eventos.length });
    total = pagina.total;
    eventos.push(...pagina.eventos);
    if (pagina.eventos.length < limite || eventos.length >= total) break;
  }
  return { eventos, total, truncado: total > eventos.length };
}
