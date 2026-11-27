import { supabase } from '../client';
import type {
  ActorTipoBitacora,
  BitacoraFilters,
  BitacoraRow,
  InformeFilters,
  InformeRow,
} from '@/domain/models/Informe';
import type { InformeRepository } from '@/domain/ports/InformeRepository';

function normalizeActorTipo(raw: string): ActorTipoBitacora {
  if (raw === 'empleado' || raw === 'usuario_externo') return raw;
  return 'sistema';
}

export const supabaseInformeRepository: InformeRepository = {
  async getInforme(filters: InformeFilters): Promise<InformeRow[]> {
    const { data, error } = await supabase.rpc('get_informe', {
      p_anio: filters.anio,
      p_mes: filters.mes ?? undefined,
      p_area_id: filters.areaId ?? undefined,
    });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      anio: row.anio,
      mes: row.mes ?? null,
      areaId: row.area_id,
      area: row.area,
      tipoAtencion: row.tipo_atencion,
      primeraVezOSeguimiento:
        row.primera_vez_o_seguimiento === 'seguimiento' ? 'seguimiento' : 'primera_vez',
      mujeres: row.mujeres,
      hombres: row.hombres,
      totalPersonas: row.total_personas,
      totalAtenciones: row.total_atenciones,
    }));
  },

  async getBitacora(filters?: BitacoraFilters): Promise<BitacoraRow[]> {
    const { data, error } = await supabase.rpc('get_bitacora', {
      p_desde: filters?.desde ?? undefined,
      p_hasta: filters?.hasta ?? undefined,
      p_tabla: filters?.tabla?.trim() || undefined,
      p_empleado_id: filters?.empleadoId ?? undefined,
      p_limite: filters?.limite ?? 100,
    });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      accion: row.accion,
      tablaAfectada: row.tabla_afectada,
      registroId: row.registro_id ?? null,
      empleadoId: row.empleado_id ?? null,
      usuarioExternoId: row.usuario_externo_id ?? null,
      actorTipo: normalizeActorTipo(row.actor_tipo),
      actorNombre: row.actor_nombre,
      actorRol: row.actor_rol ?? null,
      creadoEn: row.creado_en,
    }));
  },
};
