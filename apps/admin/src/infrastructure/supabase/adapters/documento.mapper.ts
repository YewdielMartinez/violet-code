import type { Database } from '../database.types';
import type {
  DocumentoAdjunto,
  OrdenProteccionOpcion,
  TipoDocumento,
} from '@/domain/models/DocumentoAdjunto';

export type TipoDocumentoRow = Database['public']['Tables']['cat_tipo_documento']['Row'];

type EstadoOrdenProteccion = Database['public']['Enums']['estado_orden_proteccion'];

export interface OrdenProteccionResumenRow {
  id: string;
  numero_oficio: string | null;
  estado: EstadoOrdenProteccion;
  fecha_emision: string;
  autoridad_emisora: string | null;
}

export interface DocumentoRowConTipo {
  id: string;
  ficha_id: string;
  tipo_documento_id: number;
  orden_proteccion_id: string | null;
  descripcion: string | null;
  ruta_storage: string;
  nombre_archivo: string;
  activo: boolean;
  creado_en: string;
  cat_tipo_documento: TipoDocumentoRow | TipoDocumentoRow[] | null;
}

const ESTADO_ORDEN_LABELS: Record<EstadoOrdenProteccion, string> = {
  vigente: 'Vigente',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
  en_tramite: 'En trámite',
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function mapTipoDocumentoRow(row: TipoDocumentoRow): TipoDocumento {
  return {
    id: row.id,
    clave: row.clave,
    nombre: row.nombre,
  };
}

export function mapDocumentoRow(row: DocumentoRowConTipo): DocumentoAdjunto {
  const tipo = unwrapOne(row.cat_tipo_documento);
  return {
    id: row.id,
    fichaId: row.ficha_id,
    tipoDocumentoId: row.tipo_documento_id,
    tipoDocumentoClave: tipo?.clave ?? '',
    tipoDocumentoNombre: tipo?.nombre ?? 'Documento',
    ordenProteccionId: row.orden_proteccion_id,
    descripcion: row.descripcion,
    rutaStorage: row.ruta_storage,
    nombreArchivo: row.nombre_archivo,
    activo: row.activo,
    creadoEn: row.creado_en,
  };
}

export function mapOrdenProteccionOpcion(row: OrdenProteccionResumenRow): OrdenProteccionOpcion {
  const oficio = row.numero_oficio?.trim();
  const encabezado = oficio ? `Oficio ${oficio}` : 'Orden sin oficio';
  const estado = ESTADO_ORDEN_LABELS[row.estado] ?? row.estado;
  return {
    id: row.id,
    label: `${encabezado} · ${estado} · ${row.fecha_emision}`,
  };
}

interface PostgresErrorLike {
  code?: string;
  message?: string;
  statusCode?: string | number;
}

/**
 * Traduce códigos técnicos de PostgreSQL / PostgREST / Storage a mensajes seguros en español
 * sin exponer nombres internos de restricciones ni información sensible.
 */
export function traducirErrorDocumento(error: unknown, fallback: string): Error {
  const err = (error ?? {}) as PostgresErrorLike;
  const code = err.code ?? '';

  if (code === '42501' || err.statusCode === 403 || err.statusCode === '403') {
    return new Error('No tienes permisos para realizar esta acción sobre los documentos.');
  }
  if (code === '23505') {
    return new Error('Este documento ya fue registrado anteriormente.');
  }
  if (code === '23503') {
    return new Error('Referencia inválida o catálogo no disponible. Recarga e intenta de nuevo.');
  }
  if (code === 'PGRST116') {
    return new Error('El documento solicitado no existe o ya fue archivado.');
  }
  if (code === 'P0001' && err.message) {
    return new Error(err.message);
  }
  if (error instanceof Error && error.message.trim()) {
    return error;
  }
  return new Error(fallback);
}
