import { accionBitacoraLabel, tablaBitacoraLabel, type BitacoraEvento } from '@/domain/models/Bitacora';
import { downloadBlob, toCsvBlob, toXlsx, type ExportColumn } from '@/shared/export';
import type { PrintReportOptions } from '@/shared/print';
import { actorRolLabel } from './bitacoraTableConfig';
import { fechaHoraBitacora, type BitacoraListFilters } from './bitacoraList';

/**
 * Columnas de la descarga: solo quién, qué, dónde y cuándo (lo mismo que muestra la tabla). La bitácora no guarda
 * contenido de notas ni datos personales de las usuarias, y `registro_id` es un identificador interno.
 */
export const BITACORA_EXPORT_COLUMNS: readonly ExportColumn<BitacoraEvento>[] = [
  { key: 'fecha', header: 'Fecha y hora', value: (e) => fechaHoraBitacora(e.creadoEn) },
  { key: 'actor', header: 'Quién', value: (e) => e.actorNombre },
  { key: 'rol', header: 'Rol', value: (e) => actorRolLabel(e.actorRol) },
  { key: 'tabla', header: 'Tabla', value: (e) => tablaBitacoraLabel(e.tabla) },
  { key: 'accion', header: 'Acción', value: (e) => accionBitacoraLabel(e.accion) },
  { key: 'registro', header: 'Registro', value: (e) => e.registroId ?? '' },
];

export type BitacoraExportFormato = 'csv' | 'xlsx';

function nombreArchivo(formato: BitacoraExportFormato, hoy = new Date()): string {
  const dia = [hoy.getFullYear(), String(hoy.getMonth() + 1).padStart(2, '0'), String(hoy.getDate()).padStart(2, '0')].join('-');
  return `bitacora-${dia}.${formato}`;
}

/** Descarga los eventos como CSV o Excel (textos sanitizados contra inyección de fórmulas por `shared/export`). */
export function descargarBitacora(eventos: readonly BitacoraEvento[], formato: BitacoraExportFormato): void {
  const blob =
    formato === 'csv'
      ? toCsvBlob(eventos, BITACORA_EXPORT_COLUMNS)
      : toXlsx(eventos, BITACORA_EXPORT_COLUMNS, 'Bitácora');
  downloadBlob(blob, nombreArchivo(formato));
}

/** Documento de impresión / PDF de la bitácora: mismas columnas que la descarga, con los filtros aplicados. */
export function bitacoraParaImprimir(
  eventos: readonly BitacoraEvento[],
  filtros: BitacoraListFilters,
  opciones: { total: number; truncado: boolean },
): PrintReportOptions<BitacoraEvento> {
  const tabla = filtros.tabla ? tablaBitacoraLabel(filtros.tabla) : 'Todas las tablas';
  const accion = filtros.accion ? accionBitacoraLabel(filtros.accion) : 'Todas las acciones';
  const periodo =
    filtros.desde || filtros.hasta ? `${filtros.desde || 'inicio'} a ${filtros.hasta || 'hoy'}` : 'Sin límite de fechas';
  const cantidad = opciones.truncado
    ? `${eventos.length} eventos más recientes de ${opciones.total}`
    : `${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'}`;
  return {
    title: 'Bitácora de accesos y cambios',
    subtitle: cantidad,
    filtros: [
      { label: 'Tabla', value: tabla },
      { label: 'Acción', value: accion },
      { label: 'Fechas', value: periodo },
    ],
    columns: BITACORA_EXPORT_COLUMNS,
    rows: eventos,
    monoKeys: ['registro', 'fecha'],
    nota: 'Documento de uso interno · sin contenido de notas ni datos de las usuarias',
  };
}
