import { supabase } from '../client';
import type { Database, Json } from '../database.types';
import { mapSupabaseError } from './errors';
import {
  isInternalDestino,
  type CanalizacionEvento,
  type DerivacionCreateInput,
  type DerivacionItem,
  type EstadoDerivacion,
  type HistorialCanalizacionItem,
} from '@/domain/models/Derivacion';
import type { DerivacionRepository } from '@/domain/ports/DerivacionRepository';

type RpcDerivacionRow = Database['public']['Functions']['get_derivaciones']['Returns'][number];
type RpcHistorialCanalizacionRow =
  Database['public']['Functions']['get_historial_canalizaciones']['Returns'][number];

const ESTADOS_DERIVACION_VALIDOS: ReadonlySet<string> = new Set<EstadoDerivacion>([
  'pendiente',
  'en_proceso',
  'concluida',
  'cancelada',
]);

function asEstadoDerivacion(value: unknown): EstadoDerivacion | null {
  return typeof value === 'string' && ESTADOS_DERIVACION_VALIDOS.has(value)
    ? (value as EstadoDerivacion)
    : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseCanalizacionEventos(raw: Json | null | undefined): CanalizacionEvento[] {
  if (!Array.isArray(raw)) return [];
  const eventos: CanalizacionEvento[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, Json | undefined>;
    eventos.push({
      tipo: asNullableString(record.tipo) ?? '',
      fecha: asNullableString(record.fecha) ?? '',
      estadoAnterior: asEstadoDerivacion(record.estado_anterior),
      estadoNuevo: asEstadoDerivacion(record.estado_nuevo),
      actorId: asNullableString(record.actor_id),
      actorNombre: asNullableString(record.actor_nombre),
      nota: asNullableString(record.nota),
    });
  }
  return eventos;
}

function mapHistorialRow(row: RpcHistorialCanalizacionRow): HistorialCanalizacionItem {
  return {
    id: row.id,
    fichaId: row.ficha_id,
    areaOrigenId: row.area_origen_id ?? null,
    areaOrigenNombre: row.area_origen_nombre ?? null,
    areaDestinoId: row.area_destino_id ?? null,
    areaDestinoNombre: row.area_destino_nombre ?? null,
    institucionId: row.institucion_id ?? null,
    institucionNombre: row.institucion_nombre ?? null,
    institucionOtra: row.institucion_otra ?? null,
    destino: row.destino,
    motivo: row.motivo ?? null,
    fechaDerivacion: row.fecha_derivacion,
    estado: row.estado,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
    eventos: parseCanalizacionEventos(row.eventos),
  };
}

interface CrearCanalizacionArgs {
  p_ficha_id: string;
  p_destino: DerivacionCreateInput['destino'];
  p_area_destino_id: number | null;
  p_institucion_id: number | null;
  p_institucion_otra: string | null;
  p_motivo: string;
}

interface CrearCanalizacionRow {
  derivacion_id: string;
  estado: EstadoDerivacion;
  aviso: string | null;
}

/**
 * `crear_canalizacion` (migración 33) aún no está en `database.types.ts` (se regenera con
 * `supabase gen types`); mientras tanto se tipa aquí la llamada. Retirar al regenerar los tipos.
 */
function rpcCrearCanalizacion(args: CrearCanalizacionArgs) {
  const client = supabase as unknown as {
    rpc: (
      fn: 'crear_canalizacion',
      args: CrearCanalizacionArgs,
    ) => PromiseLike<{ data: CrearCanalizacionRow[] | CrearCanalizacionRow | null; error: Error | null }>;
  };
  return client.rpc('crear_canalizacion', args);
}

function mapRpcRow(row: RpcDerivacionRow): DerivacionItem {
  return {
    id: row.id,
    fichaId: row.ficha_id,
    folio: row.folio ?? '—',
    usuariaNombre: row.usuaria_nombre?.trim() || '—',
    areaOrigenId: row.area_origen_id,
    areaOrigenNombre: row.area_origen_nombre,
    areaDestinoId: row.area_destino_id,
    areaDestinoNombre: row.area_destino_nombre,
    institucionId: row.institucion_id,
    institucionNombre: row.institucion_nombre,
    institucionOtra: row.institucion_otra,
    destino: row.destino,
    motivo: row.motivo,
    fechaDerivacion: row.fecha_derivacion,
    estado: row.estado,
    creadoEn: row.creado_en,
  };
}

export const supabaseDerivacionRepository: DerivacionRepository = {
  async list(estado?: EstadoDerivacion): Promise<DerivacionItem[]> {
    const { data, error } = await supabase.rpc('get_derivaciones', {
      p_estado: estado ?? undefined,
      p_limite: 200,
    });

    if (error) throw error;
    return (data ?? []).map(mapRpcRow);
  },

  async listByFicha(fichaId: string): Promise<DerivacionItem[]> {
    const { data, error } = await supabase.rpc('get_derivaciones', {
      p_ficha_id: fichaId,
      p_limite: 200,
    });

    if (error) throw mapSupabaseError(error);
    return (data ?? []).map(mapRpcRow);
  },

  async historialCanalizaciones(fichaId: string): Promise<HistorialCanalizacionItem[]> {
    const { data, error } = await supabase.rpc('get_historial_canalizaciones', {
      p_ficha_id: fichaId,
    });

    if (error) throw mapSupabaseError(error);
    return (data ?? []).map(mapHistorialRow);
  },

  async create(input: DerivacionCreateInput): Promise<{ id: string; aviso: string | null }> {
    const internal = isInternalDestino(input.destino);
    const otra = input.institucionOtra.trim();

    // `derivacion_insert` en RLS es `with check (false)` desde la migración 33: solo se crea vía RPC.
    // El área de origen la deriva el servidor (`auth_area_id()`), por lo que `areaOrigenId` no se envía.
    const { data, error } = await rpcCrearCanalizacion({
      p_ficha_id: input.fichaId,
      p_destino: input.destino,
      p_area_destino_id: internal ? input.areaDestinoId : null,
      p_institucion_id: !internal ? input.institucionId : null,
      p_institucion_otra: !internal && input.institucionId === null && otra ? otra : null,
      p_motivo: input.motivo.trim(),
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.derivacion_id) throw new Error('La canalización no devolvió un identificador.');
    return { id: row.derivacion_id, aviso: row.aviso ?? null };
  },

  async updateEstado(id: string, estado: EstadoDerivacion): Promise<void> {
    const { error } = await supabase.rpc('cambiar_estado_derivacion', {
      p_derivacion_id: id,
      p_estado: estado,
    });
    if (error) throw error;
  },
};
