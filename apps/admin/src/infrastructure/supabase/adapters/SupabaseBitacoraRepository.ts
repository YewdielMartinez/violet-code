import { supabase } from '../client';
import {
  ACCIONES_BITACORA,
  type AccionBitacora,
  type ActorTipoBitacora,
  type BitacoraEvento,
} from '@/domain/models/Bitacora';
import type { BitacoraRepository } from '@/domain/ports/BitacoraRepository';

interface ConsultarBitacoraArgs {
  p_tabla?: string;
  p_accion?: string;
  p_desde?: string;
  p_hasta?: string;
  p_limite: number;
  p_offset: number;
}

interface BitacoraRowDb {
  id: string;
  creado_en: string;
  actor_tipo: string;
  actor_nombre: string;
  actor_rol: string | null;
  tabla_afectada: string;
  accion: AccionBitacora;
  registro_id: string | null;
  total: number | string;
}

interface FiltroRowDb {
  tipo: string;
  valor: string;
}

type RpcResult<T> = PromiseLike<{ data: T | null; error: Error | null }>;

/**
 * `consultar_bitacora` y `get_bitacora_filtros` (migración 74) aún no están en `database.types.ts` (se regenera con
 * `supabase gen types` tras aplicar la migración); mientras tanto se tipan aquí las llamadas.
 * TODO: retirar este cast y usar `supabase.rpc(...)` directo al regenerar los tipos.
 */
const rpcBitacora = supabase as unknown as {
  rpc: {
    (fn: 'consultar_bitacora', args: ConsultarBitacoraArgs): RpcResult<BitacoraRowDb[]>;
    (fn: 'get_bitacora_filtros'): RpcResult<FiltroRowDb[]>;
  };
};

function actorTipo(raw: string): ActorTipoBitacora {
  return raw === 'empleado' || raw === 'usuario_externo' ? raw : 'sistema';
}

function toEvento(row: BitacoraRowDb): BitacoraEvento {
  return {
    id: row.id,
    creadoEn: row.creado_en,
    actorTipo: actorTipo(row.actor_tipo),
    actorNombre: row.actor_nombre,
    actorRol: row.actor_rol ?? null,
    tabla: row.tabla_afectada,
    accion: row.accion,
    registroId: row.registro_id ?? null,
  };
}

export const supabaseBitacoraRepository: BitacoraRepository = {
  async listar(input) {
    const { data, error } = await rpcBitacora.rpc('consultar_bitacora', {
      p_tabla: input.tabla ?? undefined,
      p_accion: input.accion ?? undefined,
      p_desde: input.desde ?? undefined,
      p_hasta: input.hasta ?? undefined,
      p_limite: input.limite,
      p_offset: input.offset,
    });
    if (error) throw error;

    const rows = data ?? [];
    return { eventos: rows.map(toEvento), total: rows.length ? Number(rows[0].total) : 0 };
  },

  async opcionesFiltro() {
    const { data, error } = await rpcBitacora.rpc('get_bitacora_filtros');
    if (error) throw error;

    const rows = data ?? [];
    const tablas = rows.filter((r) => r.tipo === 'tabla').map((r) => r.valor);
    const acciones = rows
      .filter((r): r is FiltroRowDb & { valor: AccionBitacora } =>
        r.tipo === 'accion' && (ACCIONES_BITACORA as readonly string[]).includes(r.valor),
      )
      .map((r) => r.valor);
    return { tablas, acciones: acciones.length ? acciones : [...ACCIONES_BITACORA] };
  },
};
