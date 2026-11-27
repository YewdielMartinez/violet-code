import type { Database, Json } from '../database.types';
import type { DomicilioActualizadoResult, DomicilioUpdateInput } from '@/domain/models/Domicilio';
import type {
  EstudioSocioeconomicoRegistradoResult,
  EstudioSocioeconomicoRegistroInput,
} from '@/domain/models/EstudioSocioeconomico';
import type { FichaActualizada, FichaUpdateInput } from '@/domain/models/FichaRegistro';
import type {
  PersonaActualizada,
  PersonaUpdateInput,
  SexoBiologico,
} from '@/domain/models/Persona';

type RpcFunctions = Database['public']['Functions'];

type ActualizarPersonaArgs = RpcFunctions['actualizar_persona']['Args'];
type ActualizarPersonaRow = RpcFunctions['actualizar_persona']['Returns'][number];
type ActualizarFichaArgs = RpcFunctions['actualizar_ficha']['Args'];
type ActualizarFichaRow = RpcFunctions['actualizar_ficha']['Returns'][number];
type ActualizarDomicilioArgs = RpcFunctions['actualizar_domicilio']['Args'];
type ActualizarDomicilioRow = RpcFunctions['actualizar_domicilio']['Returns'][number];
type RegistrarEstudioArgs = RpcFunctions['registrar_estudio_socioeconomico']['Args'];
type RegistrarEstudioRow = RpcFunctions['registrar_estudio_socioeconomico']['Returns'][number];

/** `null`/`undefined` omiten el parámetro (conserva en RPC); `''` o espacios limpian textos opcionales. */
function toOptionalRpcText(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return value.trim();
}

export function toActualizarPersonaArgs(input: PersonaUpdateInput): ActualizarPersonaArgs {
  return {
    p_persona_id: input.personaId,
    p_actualizado_en: input.actualizadoEn,
    p_nombres: toOptionalRpcText(input.nombres),
    p_apellido_paterno: toOptionalRpcText(input.apellidoPaterno),
    p_apellido_materno: toOptionalRpcText(input.apellidoMaterno),
    p_celular: toOptionalRpcText(input.celular),
    p_escolaridad: input.escolaridad ?? undefined,
    p_discapacidad: toOptionalRpcText(input.discapacidad),
    p_grupo_etnico: toOptionalRpcText(input.grupoEtnico),
    p_religion: toOptionalRpcText(input.religion),
  };
}

export function mapPersonaActualizadaRow(row: ActualizarPersonaRow): PersonaActualizada {
  return {
    id: row.id,
    curp: row.curp,
    nombres: row.nombres,
    apellidoPaterno: row.apellido_paterno,
    apellidoMaterno: row.apellido_materno ?? null,
    sexo: row.sexo as SexoBiologico,
    fechaNacimiento: row.fecha_nacimiento,
    entidadNacimiento: row.entidad_nacimiento,
    celular: row.celular ?? null,
    escolaridad: row.escolaridad ?? null,
    discapacidad: row.discapacidad ?? null,
    grupoEtnico: row.grupo_etnico ?? null,
    religion: row.religion ?? null,
    actualizadoEn: row.actualizado_en,
  };
}

export function toActualizarFichaArgs(input: FichaUpdateInput): ActualizarFichaArgs {
  return {
    p_ficha_id: input.fichaId,
    p_actualizado_en: input.actualizadoEn,
    p_estado_civil: input.estadoCivil ?? undefined,
    p_ocupacion_id: input.ocupacionId ?? undefined,
    p_ocupacion_otra: toOptionalRpcText(input.ocupacionOtra),
    p_tiene_trabajo: input.tieneTrabajo ?? undefined,
    p_numero_hijas: input.numeroHijas ?? undefined,
    p_numero_hijos_hombres: input.numeroHijosHombres ?? undefined,
    p_servicio_medico: input.servicioMedico ?? undefined,
    p_servicio_medico_otro: toOptionalRpcText(input.servicioMedicoOtro),
    p_tiene_embarazo: input.tieneEmbarazo ?? undefined,
    p_tiene_denuncia: input.tieneDenuncia ?? undefined,
    p_es_victima_delito: input.esVictimaDelito ?? undefined,
    p_drogas: input.drogas ?? undefined,
    p_especificacion_droga: toOptionalRpcText(input.especificacionDroga),
    p_consumo_alcohol: input.consumoAlcohol ?? undefined,
    p_servicios_solicitados_area_ids: input.serviciosSolicitadosAreaIds ?? undefined,
    p_campos_sin_dato: input.camposSinDato ?? undefined,
  };
}

export function mapFichaActualizadaRow(row: ActualizarFichaRow): FichaActualizada {
  return {
    id: row.id,
    folio: row.folio,
    personaId: row.persona_id,
    estado: row.estado,
    estadoCivil: row.estado_civil ?? null,
    ocupacionId: row.ocupacion_id ?? null,
    ocupacionOtra: row.ocupacion_otra ?? null,
    tieneTrabajo: row.tiene_trabajo ?? null,
    numeroHijas: row.numero_hijas ?? null,
    numeroHijosHombres: row.numero_hijos_hombres ?? null,
    servicioMedico: row.servicio_medico ?? null,
    servicioMedicoOtro: row.servicio_medico_otro ?? null,
    tieneEmbarazo: row.tiene_embarazo ?? null,
    tieneDenuncia: row.tiene_denuncia ?? null,
    esVictimaDelito: row.es_victima_delito ?? null,
    drogas: row.drogas ?? null,
    especificacionDroga: row.especificacion_droga ?? null,
    consumoAlcohol: row.consumo_alcohol ?? null,
    serviciosSolicitadosAreaIds: row.servicios_solicitados_area_ids ?? [],
    actualizadoEn: row.actualizado_en,
  };
}

export function toActualizarDomicilioArgs(input: DomicilioUpdateInput): ActualizarDomicilioArgs {
  const asentamientoId = input.asentamientoId ?? undefined;
  const codigoPostal =
    asentamientoId !== undefined ? undefined : toOptionalRpcText(input.codigoPostal);

  return {
    p_persona_id: input.personaId,
    p_actualizado_en: input.actualizadoEn ?? undefined,
    p_asentamiento_id: asentamientoId,
    p_codigo_postal: codigoPostal,
    p_calle: toOptionalRpcText(input.calle),
    p_numero_exterior: toOptionalRpcText(input.numeroExterior),
    p_numero_interior: toOptionalRpcText(input.numeroInterior),
    p_referencias: toOptionalRpcText(input.referencias),
    p_zona: input.zona ?? undefined,
  };
}

export function mapDomicilioActualizadoRow(
  row: ActualizarDomicilioRow,
): DomicilioActualizadoResult {
  return {
    domicilioId: row.domicilio_id,
    personaId: row.persona_id,
    esActual: row.es_actual,
    actualizadoEn: row.actualizado_en,
  };
}

export function toRegistrarEstudioArgs(
  input: EstudioSocioeconomicoRegistroInput,
): RegistrarEstudioArgs {
  const aportantes: Json[] = (input.aportantes ?? []).map((a) => ({
    nombre: a.nombre?.trim() || null,
    parentesco_id: a.parentescoId ?? null,
    parentesco_otro: a.parentescoOtro?.trim() || null,
    ocupacion_id: a.ocupacionId ?? null,
    ocupacion_otra: a.ocupacionOtra?.trim() || null,
    tipo_trabajo: a.tipoTrabajo ?? null,
    monto: a.monto ?? null,
    frecuencia: a.frecuencia ?? null,
  }));

  return {
    p_ficha_id: input.fichaId,
    p_ingreso_mensual_propio: input.ingresoMensualPropio ?? undefined,
    p_numero_dependientes: input.numeroDependientes ?? undefined,
    p_tiene_apoyo: input.tieneApoyo ?? false,
    p_especificacion_apoyo: toOptionalRpcText(input.especificacionApoyo),
    p_tipo_vivienda: input.tipoVivienda ?? undefined,
    p_material: input.material ?? undefined,
    p_material_otro: toOptionalRpcText(input.materialOtro),
    p_servicios: input.servicios ?? undefined,
    p_bienes: input.bienes ?? undefined,
    p_aportantes: aportantes,
  };
}

export function mapEstudioRegistradoRow(
  row: RegistrarEstudioRow,
): EstudioSocioeconomicoRegistradoResult {
  return {
    estudioId: row.estudio_id,
    fichaId: row.ficha_id,
    fechaEstudio: row.fecha_estudio,
    esActual: row.es_actual,
    fueCorreccion: row.fue_correccion,
    actualizadoEn: row.actualizado_en,
  };
}
