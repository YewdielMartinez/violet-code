import {
  isTipoDroga,
  type Agresor,
  type AgresorInput,
  type AsentamientoOpcion,
  type CatalogoOpcion,
  type TipoDroga,
} from '@/domain/models/Agresor';
import type { Database } from '../database.types';

export type AgresorRow = Pick<
  Database['public']['Tables']['agresor']['Row'],
  | 'id'
  | 'ficha_id'
  | 'nombres'
  | 'apellido_paterno'
  | 'apellido_materno'
  | 'parentesco_id'
  | 'parentesco_otro'
  | 'asentamiento_id'
  | 'codigo_postal'
  | 'calle'
  | 'numero_exterior'
  | 'numero_interior'
  | 'referencias'
  | 'ocupacion_id'
  | 'ocupacion_otra'
  | 'drogas'
  | 'especificacion_droga'
  | 'especificacion_arma'
  | 'observaciones'
  | 'activo'
  | 'actualizado_en'
>;

export type GuardarAgresorArgs = Database['public']['Functions']['guardar_agresor']['Args'];

export type AsentamientoRow = Pick<
  Database['public']['Tables']['cat_asentamiento']['Row'],
  'id' | 'nombre' | 'tipo_asentamiento' | 'codigo_postal' | 'localidad'
>;

export type CatalogoRow = Pick<
  Database['public']['Tables']['cat_parentesco']['Row'],
  'id' | 'clave' | 'nombre'
>;

function toRpcText(value: string | null | undefined, isEdit: boolean): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? '';
  if (trimmed.length > 0) return trimmed;
  return isEdit ? '' : undefined;
}

function mapDrogasFromRow(raw: string[] | null): TipoDroga[] | null {
  if (!raw || raw.length === 0) return null;
  const valid = raw.filter(isTipoDroga);
  return valid.length > 0 ? valid : null;
}

export function toGuardarAgresorArgs(
  input: AgresorInput,
  agresorId?: string | null,
): GuardarAgresorArgs {
  const isEdit = Boolean(agresorId);
  const asentamientoId = input.asentamientoId ?? null;
  const codigoPostal =
    asentamientoId !== null ? undefined : toRpcText(input.codigoPostal, isEdit);

  const tieneConsumoDroga = input.tieneConsumoDroga ?? null;
  const drogasRaw = tieneConsumoDroga === true ? (input.drogas ?? []).filter(isTipoDroga) : [];
  const drogas: TipoDroga[] | undefined =
    tieneConsumoDroga === false
      ? ['no_consume']
      : drogasRaw.length > 0
        ? Array.from(new Set(drogasRaw))
        : undefined;
  const especificacionDroga =
    tieneConsumoDroga === true ? toRpcText(input.especificacionDroga, isEdit) : undefined;

  return {
    p_agresor_id: agresorId ?? undefined,
    p_ficha_id: isEdit ? undefined : input.fichaId,
    p_actualizado_en: isEdit ? (input.actualizadoEnEsperado ?? undefined) : undefined,
    p_nombres: toRpcText(input.nombres, isEdit),
    p_apellido_paterno: toRpcText(input.apellidoPaterno, isEdit),
    p_apellido_materno: toRpcText(input.apellidoMaterno, isEdit),
    p_parentesco_id: input.parentescoId ?? undefined,
    p_parentesco_otro: toRpcText(input.parentescoOtro, isEdit),
    p_asentamiento_id: asentamientoId ?? undefined,
    p_codigo_postal: codigoPostal,
    p_calle: toRpcText(input.calle, isEdit),
    p_numero_exterior: toRpcText(input.numeroExterior, isEdit),
    p_numero_interior: toRpcText(input.numeroInterior, isEdit),
    p_referencias: toRpcText(input.referencias, isEdit),
    p_ocupacion_id: input.ocupacionId ?? undefined,
    p_ocupacion_otra: toRpcText(input.ocupacionOtra, isEdit),
    p_drogas: drogas,
    p_especificacion_droga: especificacionDroga,
    p_especificacion_arma: toRpcText(input.especificacionArma, isEdit),
    p_observaciones: toRpcText(input.observaciones, isEdit),
  };
}

export function mapAgresorRow(row: AgresorRow): Agresor {
  const tieneConsumoDroga =
    row.drogas === null || row.drogas.length === 0 ? null : !row.drogas.includes('no_consume');
  const drogas = row.drogas?.includes('no_consume') ? null : mapDrogasFromRow(row.drogas);

  return {
    id: row.id,
    fichaId: row.ficha_id,
    nombres: row.nombres ?? '',
    apellidoPaterno: row.apellido_paterno,
    apellidoMaterno: row.apellido_materno,
    parentescoId: row.parentesco_id,
    parentescoOtro: row.parentesco_otro,
    asentamientoId: row.asentamiento_id,
    codigoPostal: row.codigo_postal,
    calle: row.calle,
    numeroExterior: row.numero_exterior,
    numeroInterior: row.numero_interior,
    referencias: row.referencias,
    ocupacionId: row.ocupacion_id,
    ocupacionOtra: row.ocupacion_otra,
    tieneConsumoDroga,
    drogas,
    especificacionDroga: row.especificacion_droga,
    especificacionArma: row.especificacion_arma,
    observaciones: row.observaciones,
    activo: row.activo,
    actualizadoEn: row.actualizado_en,
  };
}

export function mapCatalogoRow(row: CatalogoRow): CatalogoOpcion {
  return {
    id: row.id,
    clave: row.clave,
    nombre: row.nombre,
  };
}

export function mapAsentamientoRow(row: AsentamientoRow): AsentamientoOpcion {
  return {
    id: row.id,
    nombre: row.nombre,
    tipoAsentamiento: row.tipo_asentamiento,
    codigoPostal: row.codigo_postal,
    localidad: row.localidad,
  };
}
