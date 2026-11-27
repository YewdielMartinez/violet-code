import {
  esOrdenVigente,
  type OrdenProteccion,
  type OrdenProteccionInput,
} from '@/domain/models/OrdenProteccion';
import type { Database } from '../database.types';

export type OrdenProteccionRow = Pick<
  Database['public']['Tables']['orden_proteccion']['Row'],
  | 'id'
  | 'ficha_id'
  | 'agresor_id'
  | 'numero_oficio'
  | 'autoridad_emisora'
  | 'fecha_emision'
  | 'fecha_vigencia'
  | 'estado'
  | 'activo'
  | 'creado_en'
  | 'actualizado_en'
>;

export type OrdenProteccionInsertRow = Database['public']['Tables']['orden_proteccion']['Insert'];
/** Tipo generado del `UPDATE` (aún sin `nota_cambio_estado`: ver TODO). */
export type OrdenProteccionUpdateTyped = Database['public']['Tables']['orden_proteccion']['Update'];
// TODO: quitar el `&` y el cast del repositorio cuando se regenere database.types.ts
// (la migración 70 agrega la columna transitoria `nota_cambio_estado`).
/** `nota_cambio_estado`: el trigger la copia a `orden_proteccion_evento` y la limpia. */
export type OrdenProteccionUpdateRow = OrdenProteccionUpdateTyped & {
  nota_cambio_estado?: string | null;
};

function normalizeNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function mapOrdenProteccionRow(
  row: OrdenProteccionRow,
  fechaReferencia?: string,
): OrdenProteccion {
  return {
    id: row.id,
    fichaId: row.ficha_id,
    agresorId: row.agresor_id,
    numeroOficio: row.numero_oficio,
    autoridadEmisora: row.autoridad_emisora,
    fechaEmision: row.fecha_emision,
    fechaVigencia: row.fecha_vigencia,
    estado: row.estado,
    vigente: esOrdenVigente(
      {
        activo: row.activo,
        estado: row.estado,
        fechaVigencia: row.fecha_vigencia,
      },
      fechaReferencia,
    ),
    activo: row.activo,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

export function toOrdenProteccionInsert(input: OrdenProteccionInput): OrdenProteccionInsertRow {
  return {
    ficha_id: input.fichaId,
    agresor_id: input.agresorId || null,
    numero_oficio: normalizeNullableText(input.numeroOficio),
    autoridad_emisora: normalizeNullableText(input.autoridadEmisora),
    fecha_emision: input.fechaEmision.trim(),
    fecha_vigencia: normalizeNullableText(input.fechaVigencia),
    estado: input.estado,
  };
}

export function toOrdenProteccionUpdate(input: OrdenProteccionInput): OrdenProteccionUpdateRow {
  const nota = normalizeNullableText(input.notaCambioEstado);
  return {
    agresor_id: input.agresorId || null,
    numero_oficio: normalizeNullableText(input.numeroOficio),
    autoridad_emisora: normalizeNullableText(input.autoridadEmisora),
    fecha_emision: input.fechaEmision.trim(),
    fecha_vigencia: normalizeNullableText(input.fechaVigencia),
    estado: input.estado,
    ...(nota ? { nota_cambio_estado: nota } : {}),
  };
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

export function traducirErrorOrdenProteccion(error: unknown, fallback: string): Error {
  const err = (error ?? {}) as PostgrestLikeError;
  switch (err.code) {
    case '42501':
      return new Error('No tienes permisos para consultar o modificar órdenes de protección.');
    case '23503':
      return new Error('La ficha o persona agresora seleccionada no corresponde al expediente.');
    case '23505':
      return new Error('Ya existe una orden de protección con esos datos.');
    case '23514':
      return new Error('Verifica las fechas y longitudes de la orden de protección.');
    case 'P0001':
      return new Error(err.message || 'La orden de protección no cumple las reglas de negocio.');
    default:
      if (error instanceof Error && error.message.trim()) {
        return error;
      }
      return new Error(fallback);
  }
}
