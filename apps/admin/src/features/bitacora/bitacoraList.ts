import type { AccionBitacora, BitacoraFiltros } from '@/domain/models/Bitacora';

/** Eventos por página: el RPC acepta hasta 200; 25 mantiene la tabla legible sin desplazarse de más. */
export const BITACORA_PAGE_SIZE = 25;

/** Tope de eventos de una descarga (CSV / Excel): evita archivos enormes y ráfagas de peticiones. */
export const BITACORA_EXPORT_MAX = 2000;

/** Filtros de la pantalla tal como los captura la barra (`desde` / `hasta` son `YYYY-MM-DD` o vacío). */
export interface BitacoraListFilters {
  /** Vacío = todas las tablas. */
  tabla: string;
  /** Vacío = todas las acciones. */
  accion: AccionBitacora | '';
  desde: string;
  hasta: string;
}

export const FILTROS_INICIALES: BitacoraListFilters = { tabla: '', accion: '', desde: '', hasta: '' };

export function hayFiltrosActivos(filtros: BitacoraListFilters): boolean {
  return Boolean(filtros.tabla || filtros.accion || filtros.desde || filtros.hasta);
}

/** `true` si «desde» es posterior a «hasta» (rango imposible: no se consulta). */
export function rangoInvalido(filtros: Pick<BitacoraListFilters, 'desde' | 'hasta'>): boolean {
  return Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);
}

/** Inicio (00:00:00.000) o fin (23:59:59.999) del día `YYYY-MM-DD` en hora local del navegador, como ISO. */
function limiteDelDia(dia: string, fin: boolean): string | null {
  const date = new Date(`${dia}T${fin ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Filtros del servidor a partir de los de la barra; `null` si el rango de fechas es inválido. */
export function construirFiltrosServidor(filtros: BitacoraListFilters): BitacoraFiltros | null {
  if (rangoInvalido(filtros)) return null;
  return {
    tabla: filtros.tabla || null,
    accion: filtros.accion || null,
    desde: filtros.desde ? limiteDelDia(filtros.desde, false) : null,
    hasta: filtros.hasta ? limiteDelDia(filtros.hasta, true) : null,
  };
}

/** Número de páginas para `total` eventos (mínimo 1). */
export function totalPaginas(total: number, tamano = BITACORA_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / tamano));
}

const FECHA_FMT = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
const HORA_FMT = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** «27 nov 2026 · 14:32:05» en la zona del navegador. */
export function fechaHoraBitacora(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${FECHA_FMT.format(date).replace(/\./g, '')} · ${HORA_FMT.format(date)}`;
}
