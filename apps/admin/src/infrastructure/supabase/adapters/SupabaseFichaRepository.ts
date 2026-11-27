import { supabase } from '../client';
import type { Json } from '../database.types';
import { mapSupabaseError } from './errors';
import {
  mapDomicilioActualizadoRow,
  mapEstudioRegistradoRow,
  mapFichaActualizadaRow,
  mapPersonaActualizadaRow,
  toActualizarDomicilioArgs,
  toActualizarFichaArgs,
  toActualizarPersonaArgs,
  toRegistrarEstudioArgs,
} from './fichaEdicion.mapper';
import type { TipoDroga } from '@/domain/models/Agresor';
import type { PrioridadNivel } from '@/domain/models/Cita';
import type {
  DomicilioActualizadoResult,
  DomicilioDetalle,
  DomicilioUpdateInput,
  ZonaGeografica,
} from '@/domain/models/Domicilio';
import type {
  EstudioSocioeconomicoDetalle,
  EstudioSocioeconomicoRegistradoResult,
  EstudioSocioeconomicoRegistroInput,
  FrecuenciaIngreso,
  MaterialVivienda,
  TipoTrabajo,
  TipoVivienda,
} from '@/domain/models/EstudioSocioeconomico';
import type {
  CambiarPrioridadExpedienteResult,
  ConsumoAlcohol,
  EscolaridadNivel,
  EstadoCivil,
  FichaActualizada,
  FichaCompletaDetalle,
  FichaCreateInput,
  FichaUpdateInput,
  ServicioMedico,
} from '@/domain/models/FichaRegistro';
import {
  formatFullName,
  normalizeCurp,
  type EstadoFicha,
  type PersonaActualizada,
  type PersonaUpdateInput,
  type SexoBiologico,
} from '@/domain/models/Persona';
import type { CreatedFichaResult, FichaRepository } from '@/domain/ports/FichaRepository';

interface RpcDetallePayload {
  ficha: {
    id: string;
    folio: string;
    estado: EstadoFicha;
    prioridad?: PrioridadNivel | null;
    prioridad_actualizada_en?: string | null;
    registrada_en: string;
    actualizado_en?: string | null;
    aviso_privacidad_aceptado_en: string;
    estado_civil: EstadoCivil | null;
    ocupacion_id?: number | null;
    ocupacion_nombre: string | null;
    ocupacion_otra?: string | null;
    servicio_medico: ServicioMedico | null;
    servicio_medico_otro: string | null;
    tiene_trabajo: boolean | null;
    numero_hijas: number | null;
    numero_hijos_hombres: number | null;
    tiene_embarazo: boolean | null;
    tiene_denuncia: boolean | null;
    es_victima_delito: boolean | null;
    drogas?: TipoDroga[] | null;
    especificacion_droga?: string | null;
    consumo_alcohol?: ConsumoAlcohol | null;
  };
  persona: {
    id: string;
    curp: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    sexo: string;
    fecha_nacimiento: string;
    entidad_nacimiento: string;
    celular: string | null;
    escolaridad?: EscolaridadNivel | null;
    discapacidad?: string | null;
    grupo_etnico?: string | null;
    religion?: string | null;
    actualizado_en?: string | null;
  };
  servicios_solicitados?: { area_id: number; clave: string; nombre: string }[];
  domicilio_actual?: {
    id: string;
    asentamiento_id: number | null;
    asentamiento_nombre: string | null;
    codigo_postal: string | null;
    calle: string | null;
    numero_exterior: string | null;
    numero_interior: string | null;
    referencias: string | null;
    zona: ZonaGeografica | null;
    actualizado_en?: string | null;
  } | null;
  estudio_actual?: {
    id: string;
    fecha_estudio: string;
    ingreso_mensual_propio: number | null;
    numero_dependientes: number | null;
    tiene_apoyo: boolean | null;
    especificacion_apoyo: string | null;
    tipo_vivienda: TipoVivienda | null;
    material: MaterialVivienda | null;
    material_otro: string | null;
    servicios: EstudioSocioeconomicoDetalle['servicios'] | null;
    bienes: EstudioSocioeconomicoDetalle['bienes'] | null;
    actualizado_en?: string | null;
    aportantes?: {
      id: string;
      nombre: string;
      parentesco_id?: number | null;
      parentesco_nombre: string | null;
      parentesco_otro: string | null;
      ocupacion_id?: number | null;
      ocupacion_nombre: string | null;
      ocupacion_otra: string | null;
      tipo_trabajo: TipoTrabajo | null;
      monto: number | null;
      frecuencia: FrecuenciaIngreso | null;
    }[];
  } | null;
}

function mapDetallePayload(raw: RpcDetallePayload): FichaCompletaDetalle {
  const { ficha, persona } = raw;
  const domRow = raw.domicilio_actual ?? null;
  const estRow = raw.estudio_actual ?? null;

  const domicilio: DomicilioDetalle | null = domRow
    ? {
        id: domRow.id,
        asentamientoId: domRow.asentamiento_id,
        asentamientoNombre: domRow.asentamiento_nombre ?? null,
        codigoPostal: domRow.codigo_postal ?? null,
        calle: domRow.calle,
        numeroExterior: domRow.numero_exterior,
        numeroInterior: domRow.numero_interior,
        referencias: domRow.referencias,
        zona: domRow.zona,
        actualizadoEn: domRow.actualizado_en ?? null,
      }
    : null;

  const estudio: EstudioSocioeconomicoDetalle | null = estRow
    ? {
        id: estRow.id,
        fechaEstudio: estRow.fecha_estudio,
        ingresoMensualPropio: estRow.ingreso_mensual_propio,
        numeroDependientes: estRow.numero_dependientes,
        tieneApoyo: Boolean(estRow.tiene_apoyo),
        especificacionApoyo: estRow.especificacion_apoyo,
        tipoVivienda: estRow.tipo_vivienda,
        material: estRow.material,
        materialOtro: estRow.material_otro,
        servicios: estRow.servicios ?? [],
        bienes: estRow.bienes ?? [],
        actualizadoEn: estRow.actualizado_en ?? null,
        aportantes: (estRow.aportantes ?? []).map((ap) => ({
          id: ap.id,
          nombre: ap.nombre,
          parentescoId: ap.parentesco_id ?? null,
          parentescoNombre: ap.parentesco_nombre ?? ap.parentesco_otro ?? null,
          parentescoOtro: ap.parentesco_otro ?? null,
          ocupacionId: ap.ocupacion_id ?? null,
          ocupacionNombre: ap.ocupacion_nombre ?? ap.ocupacion_otra ?? null,
          ocupacionOtra: ap.ocupacion_otra ?? null,
          tipoTrabajo: ap.tipo_trabajo,
          monto: ap.monto,
          frecuencia: ap.frecuencia,
        })),
      }
    : null;

  const sexo: SexoBiologico = persona.sexo === 'H' ? 'H' : 'M';
  const serviciosRows = raw.servicios_solicitados ?? [];

  return {
    id: ficha.id,
    folio: ficha.folio,
    estado: ficha.estado,
    prioridad: ficha.prioridad ?? null,
    prioridadActualizadaEn: ficha.prioridad_actualizada_en ?? null,
    registradaEn: ficha.registrada_en,
    actualizadoEn: ficha.actualizado_en ?? null,
    avisoPrivacidadAceptadoEn: ficha.aviso_privacidad_aceptado_en,
    estadoCivil: ficha.estado_civil,
    ocupacionId: ficha.ocupacion_id ?? null,
    ocupacionNombre: ficha.ocupacion_nombre ?? null,
    ocupacionOtra: ficha.ocupacion_otra ?? null,
    servicioMedico: ficha.servicio_medico,
    servicioMedicoOtro: ficha.servicio_medico_otro,
    tieneTrabajo: ficha.tiene_trabajo,
    numeroHijas: ficha.numero_hijas,
    numeroHijosHombres: ficha.numero_hijos_hombres,
    tieneEmbarazo: ficha.tiene_embarazo,
    tieneDenuncia: ficha.tiene_denuncia,
    esVictimaDelito: ficha.es_victima_delito,
    drogas: ficha.drogas ?? [],
    especificacionDroga: ficha.especificacion_droga ?? null,
    consumoAlcohol: ficha.consumo_alcohol ?? null,
    serviciosSolicitados: serviciosRows
      .map((s) => s.nombre)
      .filter((name): name is string => Boolean(name)),
    serviciosSolicitadosAreaIds: serviciosRows.map((s) => s.area_id),
    persona: {
      id: persona.id,
      curp: normalizeCurp(persona.curp),
      nombres: persona.nombres,
      apellidoPaterno: persona.apellido_paterno,
      apellidoMaterno: persona.apellido_materno,
      nombreCompleto: formatFullName(
        persona.nombres,
        persona.apellido_paterno,
        persona.apellido_materno,
      ),
      sexo,
      fechaNacimiento: persona.fecha_nacimiento,
      entidadNacimiento: persona.entidad_nacimiento,
      celular: persona.celular,
      escolaridad: persona.escolaridad ?? null,
      discapacidad: persona.discapacidad ?? null,
      grupoEtnico: persona.grupo_etnico ?? null,
      religion: persona.religion ?? null,
      actualizadoEn: persona.actualizado_en ?? null,
    },
    domicilio,
    estudio,
  };
}

export const supabaseFichaRepository: FichaRepository = {
  async createComplete(input: FichaCreateInput): Promise<CreatedFichaResult> {
    const payload: FichaCreateInput = {
      ...input,
      identidad: {
        ...input.identidad,
        curp: normalizeCurp(input.identidad.curp),
      },
    };

    const { data, error } = await supabase.rpc('crear_ficha_completa', {
      p_payload: payload as unknown as Json,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió el folio del expediente creado.');
    }

    return {
      fichaId: row.ficha_id,
      folio: row.folio,
      personaId: row.persona_id,
    };
  },

  async getDetail(fichaId: string): Promise<FichaCompletaDetalle | null> {
    const { data, error } = await supabase.rpc('get_expediente_detalle', {
      p_ficha_id: fichaId,
      p_incluir_agresores: false,
    });

    if (error) {
      if (error.code === '23514') return null;
      throw error;
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return null;
    }

    return mapDetallePayload(data as unknown as RpcDetallePayload);
  },

  async actualizarPersona(input: PersonaUpdateInput): Promise<PersonaActualizada> {
    const { data, error } = await supabase.rpc('actualizar_persona', toActualizarPersonaArgs(input));

    if (error) throw mapSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió los datos actualizados de la persona.');
    }
    return mapPersonaActualizadaRow(row);
  },

  async actualizar(input: FichaUpdateInput): Promise<FichaActualizada> {
    const { data, error } = await supabase.rpc('actualizar_ficha', toActualizarFichaArgs(input));

    if (error) throw mapSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió los datos actualizados del expediente.');
    }
    return mapFichaActualizadaRow(row);
  },

  async actualizarDomicilio(input: DomicilioUpdateInput): Promise<DomicilioActualizadoResult> {
    const { data, error } = await supabase.rpc(
      'actualizar_domicilio',
      toActualizarDomicilioArgs(input),
    );

    if (error) throw mapSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió el domicilio actualizado.');
    }
    return mapDomicilioActualizadoRow(row);
  },

  async cambiarPrioridad(
    fichaId: string,
    prioridad: PrioridadNivel,
  ): Promise<CambiarPrioridadExpedienteResult> {
    const { data, error } = await supabase.rpc('cambiar_prioridad_expediente', {
      p_ficha_id: fichaId,
      p_prioridad: prioridad,
    });

    if (error) throw mapSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió la prioridad actualizada del expediente.');
    }
    return {
      fichaId: row.ficha_id,
      prioridad: row.prioridad,
      prioridadActualizadaEn: row.prioridad_actualizada_en,
    };
  },

  async registrarEstudioSocioeconomico(
    input: EstudioSocioeconomicoRegistroInput,
  ): Promise<EstudioSocioeconomicoRegistradoResult> {
    const { data, error } = await supabase.rpc(
      'registrar_estudio_socioeconomico',
      toRegistrarEstudioArgs(input),
    );

    if (error) throw mapSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió el estudio socioeconómico registrado.');
    }
    return mapEstudioRegistradoRow(row);
  },

  async archive(fichaId: string, motivo?: string): Promise<void> {
    const { error } = await supabase.rpc('archivar_ficha', {
      p_ficha_id: fichaId,
      p_motivo: motivo ?? undefined,
    });
    if (error) throw error;
  },

  async reopen(fichaId: string, motivo: string): Promise<EstadoFicha> {
    const { data, error } = await supabase
      .rpc('reabrir_ficha', { p_ficha_id: fichaId, p_motivo: motivo })
      .single();
    if (error) throw error;
    return data.estado;
  },

  /** @deprecated No hay RPC de baja física y la RLS sobre `ficha_registro` bloquea el update directo (`42501`). Usar `archive`. */
  async deactivate(fichaId: string): Promise<void> {
    const { error } = await supabase
      .from('ficha_registro')
      .update({ activo: false })
      .eq('id', fichaId);
    if (error) throw error;
  },
};
