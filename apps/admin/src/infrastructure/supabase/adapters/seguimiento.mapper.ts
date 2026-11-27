import type { Database } from '../database.types';
import type { DomicilioDetalle } from '@/domain/models/Domicilio';
import type { TipoAtencion } from '@/domain/models/HojaSeguimiento';
import type { NotaPrivada } from '@/domain/models/NotaPrivada';
import {
  esTipoEventoConocido,
  normalizarTipoEvento,
  type TipoEventoConocido,
  type TipoEventoLineaTiempo,
} from '@/domain/models/Seguimiento';

type Tables = Database['public']['Tables'];
type NotaRow = Tables['nota_area']['Row'] & { cat_area?: { nombre: string } | null };
type TipoAtencionRow = Pick<Tables['cat_tipo_atencion']['Row'], 'id' | 'area_id' | 'clave' | 'nombre'>;
type DomicilioRow = Pick<
  Tables['domicilio']['Row'],
  | 'id'
  | 'asentamiento_id'
  | 'codigo_postal'
  | 'calle'
  | 'numero_exterior'
  | 'numero_interior'
  | 'referencias'
  | 'zona'
> & { cat_asentamiento: { nombre: string; codigo_postal: string } | null };

export const NOTA_SELECT =
  'id, ficha_id, area_id, contenido, activo, creado_en, actualizado_en, creado_por, cat_area(nombre)';
export const DOMICILIO_SELECT =
  'id, asentamiento_id, codigo_postal, calle, numero_exterior, numero_interior, referencias, zona, cat_asentamiento(nombre, codigo_postal)';

/**
 * Normaliza el `tipo` del RPC: conocido → tal cual; futuro desconocido → `'otro'` (render genérico);
 * notas privadas → `null` (se descarta). Nunca registra el contenido del evento.
 */
export function mapEventType(raw: string): TipoEventoLineaTiempo | null {
  return normalizarTipoEvento(raw);
}

/** `true` solo para los tipos conocidos. */
export function isEventType(raw: string): raw is TipoEventoConocido {
  return esTipoEventoConocido(raw);
}

export function mapNotaRow(row: NotaRow): NotaPrivada {
  return {
    id: row.id,
    fichaId: row.ficha_id,
    areaId: row.area_id,
    areaNombre: row.cat_area?.nombre ?? null,
    contenido: row.contenido,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
    creadoPor: row.creado_por,
  };
}

export function mapTipoAtencionRow(row: TipoAtencionRow): TipoAtencion {
  return { id: row.id, areaId: row.area_id, clave: row.clave, nombre: row.nombre };
}

export function mapDomicilioRow(row: DomicilioRow | null): DomicilioDetalle | null {
  if (!row) return null;
  return {
    id: row.id,
    asentamientoId: row.asentamiento_id,
    asentamientoNombre: row.cat_asentamiento?.nombre ?? null,
    // CP efectivo: el manual o el del asentamiento del catálogo.
    codigoPostal: row.codigo_postal ?? row.cat_asentamiento?.codigo_postal ?? null,
    calle: row.calle,
    numeroExterior: row.numero_exterior,
    numeroInterior: row.numero_interior,
    referencias: row.referencias,
    zona: row.zona,
  };
}
