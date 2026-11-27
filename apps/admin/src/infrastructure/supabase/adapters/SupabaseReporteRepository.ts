import { supabase } from '../client';
import { REPORTE_TIPOS, type AreaOption, type ReporteFilters, type ReporteRow } from '@/domain/models/Reporte';
import type { ReporteRepository } from '@/domain/ports/ReporteRepository';

interface GetReporteArgs {
  p_tipo: string;
  p_desde: string;
  p_hasta: string;
  p_area_id?: number;
  p_agrupar: string;
}

interface ReporteRowDb {
  tipo: string;
  mes: string | null;
  area_id: number | null;
  area: string | null;
  categoria: string | null;
  estado: string | null;
  total: number | string;
  personas: number | string | null;
  mujeres: number | string | null;
  hombres: number | string | null;
  metrica: number | string | null;
}

type RpcResult<T> = PromiseLike<{ data: T | null; error: Error | null }>;

/**
 * `get_reporte` (migración 75) aún no está en `database.types.ts` (se regenera con `supabase gen types` tras aplicar la
 * migración); mientras tanto se tipa aquí la llamada.
 * TODO: retirar este cast y usar `supabase.rpc('get_reporte', ...)` directo al regenerar los tipos.
 */
const rpcReporte = supabase as unknown as {
  rpc(fn: 'get_reporte', args: GetReporteArgs): RpcResult<ReporteRowDb[]>;
};

/** `bigint` y `numeric` llegan como número o como texto según el driver: se normalizan a número. */
function num(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function tipoOf(raw: string): ReporteRow['tipo'] {
  return (REPORTE_TIPOS as readonly string[]).includes(raw) ? (raw as ReporteRow['tipo']) : 'atenciones';
}

export function toReporteRow(row: ReporteRowDb): ReporteRow {
  return {
    tipo: tipoOf(row.tipo),
    mes: row.mes ?? null,
    areaId: row.area_id ?? null,
    area: row.area ?? null,
    categoria: row.categoria ?? null,
    estado: row.estado ?? null,
    total: num(row.total) ?? 0,
    personas: num(row.personas),
    mujeres: num(row.mujeres),
    hombres: num(row.hombres),
    metrica: num(row.metrica),
  };
}

export const supabaseReporteRepository: ReporteRepository = {
  async getReporte(filters: ReporteFilters): Promise<ReporteRow[]> {
    const { data, error } = await rpcReporte.rpc('get_reporte', {
      p_tipo: filters.tipo,
      p_desde: filters.desde,
      p_hasta: filters.hasta,
      p_area_id: filters.areaId ?? undefined,
      p_agrupar: filters.agrupar ?? 'mes',
    });
    if (error) throw error;
    return (data ?? []).map(toReporteRow);
  },

  async listAreas(): Promise<AreaOption[]> {
    const { data, error } = await supabase.from('cat_area').select('id, clave, nombre').order('id');
    if (error) throw error;
    return (data ?? []).map((row) => ({ id: row.id, clave: row.clave, nombre: row.nombre }));
  },
};
