/** Tipos de reporte agregado de la pantalla «Estadísticas» (`get_reporte`, migración 75). */
export const REPORTE_TIPOS = [
  'atenciones',
  'citas',
  'canalizaciones',
  'ordenes_proteccion',
  'actividades',
  'alertas',
] as const;

export type ReporteTipo = (typeof REPORTE_TIPOS)[number];

/**
 * - `mes`: una fila por mes (tendencias).
 * - `periodo`: todo el rango junto, desglosado por área / categoría / estado.
 * - `total`: solo atenciones, una fila con las personas distintas de todo el rango.
 */
export type ReporteAgrupacion = 'mes' | 'periodo' | 'total';

export interface ReporteFilters {
  tipo: ReporteTipo;
  /** `YYYY-MM-DD`, inclusive. */
  desde: string;
  /** `YYYY-MM-DD`, inclusive. */
  hasta: string;
  /** Solo Dirección lo elige; las áreas de atención las fuerza el servidor a la suya. */
  areaId?: number | null;
  agrupar?: ReporteAgrupacion;
}

/**
 * Fila agregada: nunca lleva CURP, nombres ni ids de personas. Qué significan `categoria`, `estado` y `metrica`
 * depende del tipo (ver `supabase/doc-supabase/rpcs/get_reporte.md`).
 */
export interface ReporteRow {
  tipo: ReporteTipo;
  /** Primer día del mes (`YYYY-MM-DD`) cuando se agrupa por mes. */
  mes: string | null;
  areaId: number | null;
  area: string | null;
  categoria: string | null;
  estado: string | null;
  total: number;
  /** Personas distintas (solo atenciones). */
  personas: number | null;
  mujeres: number | null;
  hombres: number | null;
  metrica: number | null;
}

export interface AreaOption {
  id: number;
  clave: string;
  nombre: string;
}
