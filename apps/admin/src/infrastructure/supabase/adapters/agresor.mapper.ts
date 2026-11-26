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
  | 'tiene_consumo_droga'
  | 'drogas'
  | 'especificacion_droga'
  | 'utilizo_arma_u_objeto'
  | 'especificacion_arma'
  | 'observaciones'
  | 'activo'
  | 'actualizado_en'
>;

export type AgresorInsertRow = Database['public']['Tables']['agresor']['Insert'];
export type AgresorUpdateRow = Database['public']['Tables']['agresor']['Update'];

export type AsentamientoRow = Pick<
  Database['public']['Tables']['cat_asentamiento']['Row'],
  'id' | 'nombre' | 'tipo_asentamiento' | 'codigo_postal' | 'localidad'
>;

export type CatalogoRow = Pick<
  Database['public']['Tables']['cat_parentesco']['Row'],
  'id' | 'clave' | 'nombre'
>;

function normalizeNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function mapDrogasFromRow(raw: string[] | null): TipoDroga[] | null {
  if (!raw || raw.length === 0) return null;
  const valid = raw.filter(isTipoDroga);
  return valid.length > 0 ? valid : null;
}

function buildPayload(input: AgresorInput): Omit<AgresorInsertRow, 'ficha_id'> {
  const asentamientoId = input.asentamientoId ?? null;
  const codigoPostal = asentamientoId !== null ? null : normalizeNullableText(input.codigoPostal);

  const tieneConsumoDroga = input.tieneConsumoDroga ?? null;
  const drogasRaw = tieneConsumoDroga === true ? (input.drogas ?? []).filter(isTipoDroga) : [];
  const drogas = drogasRaw.length > 0 ? Array.from(new Set(drogasRaw)) : null;
  const especificacionDroga =
    tieneConsumoDroga === true ? normalizeNullableText(input.especificacionDroga) : null;

  const utilizoArmaUObjeto = input.utilizoArmaUObjeto ?? null;
  const especificacionArma =
    utilizoArmaUObjeto === true ? normalizeNullableText(input.especificacionArma) : null;

  return {
    nombres: input.nombres.trim(),
    apellido_paterno: normalizeNullableText(input.apellidoPaterno),
    apellido_materno: normalizeNullableText(input.apellidoMaterno),
    parentesco_id: input.parentescoId ?? null,
    parentesco_otro: normalizeNullableText(input.parentescoOtro),
    asentamiento_id: asentamientoId,
    codigo_postal: codigoPostal,
    calle: normalizeNullableText(input.calle),
    numero_exterior: normalizeNullableText(input.numeroExterior),
    numero_interior: normalizeNullableText(input.numeroInterior),
    referencias: normalizeNullableText(input.referencias),
    ocupacion_id: input.ocupacionId ?? null,
    ocupacion_otra: normalizeNullableText(input.ocupacionOtra),
    tiene_consumo_droga: tieneConsumoDroga,
    drogas,
    especificacion_droga: especificacionDroga,
    utilizo_arma_u_objeto: utilizoArmaUObjeto,
    especificacion_arma: especificacionArma,
    observaciones: normalizeNullableText(input.observaciones),
  };
}

export function mapAgresorRow(row: AgresorRow): Agresor {
  return {
    id: row.id,
    fichaId: row.ficha_id,
    nombres: row.nombres,
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
    tieneConsumoDroga: row.tiene_consumo_droga,
    drogas: mapDrogasFromRow(row.drogas),
    especificacionDroga: row.especificacion_droga,
    utilizoArmaUObjeto: row.utilizo_arma_u_objeto,
    especificacionArma: row.especificacion_arma,
    observaciones: row.observaciones,
    activo: row.activo,
    actualizadoEn: row.actualizado_en,
  };
}

export function toAgresorInsert(input: AgresorInput): AgresorInsertRow {
  return {
    ficha_id: input.fichaId,
    ...buildPayload(input),
  };
}

export function toAgresorUpdate(input: AgresorInput): AgresorUpdateRow {
  return buildPayload(input);
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
