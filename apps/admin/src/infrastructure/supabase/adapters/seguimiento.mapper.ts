import type { Database } from '../database.types';
import type { DomicilioDetalle, DomicilioInput } from '@/domain/models/Domicilio';
import type { HojaSeguimientoCopia, TipoAtencion } from '@/domain/models/HojaSeguimiento';
import type { NotaPrivada } from '@/domain/models/NotaPrivada';
import type { TipoEventoLineaTiempo } from '@/domain/models/Seguimiento';

type Tables = Database['public']['Tables'];
type NotaRow = Tables['nota_area']['Row'];
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

export const NOTA_SELECT = 'id, ficha_id, area_id, contenido, activo, creado_en, actualizado_en, creado_por';
export const DOMICILIO_SELECT =
  'id, asentamiento_id, codigo_postal, calle, numero_exterior, numero_interior, referencias, zona, cat_asentamiento(nombre, codigo_postal)';

const EVENT_TYPES: ReadonlySet<string> = new Set<TipoEventoLineaTiempo>([
  'registro',
  'cita',
  'atencion',
  'derivacion',
  'orden_proteccion',
  'alerta',
]);

/** `true` solo para los tipos conocidos; un tipo desconocido se descarta en lugar de reetiquetarse. */
export function isEventType(raw: string): raw is TipoEventoLineaTiempo {
  return EVENT_TYPES.has(raw);
}

export function mapNotaRow(row: NotaRow): NotaPrivada {
  return {
    id: row.id,
    fichaId: row.ficha_id,
    areaId: row.area_id,
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

const clean = (value: string | null | undefined) => value?.trim() || null;

/** Domicilio histórico de la sesión: se inserta como no vigente para no reemplazar el de la ficha. */
export function toDomicilioHistoricoInsert(
  personaId: string,
  input: DomicilioInput,
): Tables['domicilio']['Insert'] {
  return {
    persona_id: personaId,
    asentamiento_id: input.asentamientoId,
    codigo_postal: input.asentamientoId === null ? clean(input.codigoPostalForaneo) : null,
    calle: clean(input.calle),
    numero_exterior: clean(input.numeroExterior),
    numero_interior: clean(input.numeroInterior),
    referencias: clean(input.referencias),
    zona: input.zona || null,
    es_actual: false,
  };
}

export function toAtencionCopiaUpdate(
  copia: HojaSeguimientoCopia,
  domicilioId: string | null,
): Tables['atencion']['Update'] {
  return {
    estado_civil: copia.estadoCivil,
    ocupacion_id: copia.ocupacionId,
    ocupacion_otra: clean(copia.ocupacionOtra),
    celular: clean(copia.celular),
    ...(domicilioId ? { domicilio_id: domicilioId } : {}),
  };
}
