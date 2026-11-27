import { REPORTE_TIPOS, type ReporteRow, type ReporteTipo } from '@/domain/models/Reporte';
import { distribucionPorTipo, resumenPuntos, type Punto } from './estadisticas';

/**
 * Catálogo de reportes por área: cada tipo sabe armar su tabla (para pantalla y exportación), sus indicadores y su
 * gráfica a partir de las filas AGREGADAS de `get_reporte`. Nunca hay datos personales: solo conteos.
 */

export type Celda = string | number | null;

export interface ReporteColumna {
  key: string;
  header: string;
  numeric?: boolean;
}

export type ReporteFila = { id: string } & Record<string, Celda>;

export interface ReporteTabla {
  columnas: ReporteColumna[];
  filas: ReporteFila[];
}

export interface ReporteKpi {
  label: string;
  value: string;
}

export type ReporteGrafica =
  | { kind: 'barras'; titulo: string; serie: string; labels: string[]; values: number[] }
  | { kind: 'hbars'; titulo: string; puntos: Punto[] };

export interface ReporteVista {
  tabla: ReporteTabla;
  kpis: ReporteKpi[];
  grafica: ReporteGrafica;
  /** Frase para `aria-label` de la gráfica. */
  resumenGrafica: string;
  /** `true` si no hay ninguna fila que mostrar. */
  vacio: boolean;
}

export interface ReporteDef {
  tipo: ReporteTipo;
  label: string;
  descripcion: string;
  /** `false` cuando el dato no pertenece a un área (actividades y alertas): el selector de área no aplica. */
  aplicaArea: boolean;
  construir(rows: readonly ReporteRow[]): ReporteVista;
}

// ── Etiquetas en español ────────────────────────────────────────────────────────────────────────────────────────────

export const ESTADO_CITA_LABELS: Record<string, string> = {
  agendada: 'Agendadas',
  confirmada: 'Confirmadas',
  reagendada: 'Reagendadas',
  asistio: 'Asistió',
  no_asistio: 'No asistió',
  cancelada: 'Canceladas',
};

export const DESTINO_LABELS: Record<string, string> = {
  trabajo_social: 'Trabajo Social',
  psicologia: 'Psicología',
  juridico: 'Jurídico',
  fiscalia: 'Fiscalía',
  refugio: 'Refugio',
  capacitacion: 'Capacitación',
  otra_institucion: 'Otra institución',
};

export const ESTADO_DERIVACION_LABELS: Record<string, string> = {
  pendiente: 'Pendientes',
  en_proceso: 'En proceso',
  concluida: 'Concluidas',
  cancelada: 'Canceladas',
};

export const ESTADO_ORDEN_LABELS: Record<string, string> = {
  en_tramite: 'En trámite',
  vigente: 'Vigentes',
  vencida: 'Vencidas',
  cancelada: 'Canceladas',
};

export const TIPO_INSTITUCION_LABELS: Record<string, string> = {
  escuela: 'Escuela',
  empresa_privada: 'Empresa privada',
  sector_publico: 'Sector público',
  comunidad: 'Comunidad',
  otro: 'Otro',
};

export const ESTADO_ACTIVIDAD_LABELS: Record<string, string> = {
  pendiente: 'Pendientes',
  realizada: 'Realizadas',
  cancelada: 'Canceladas',
};

export const ORIGEN_ALERTA_LABELS: Record<string, string> = {
  app_movil: 'App móvil',
  telefono: 'Teléfono',
  presencial: 'Presencial',
};

export const ESTADO_ALERTA_LABELS: Record<string, string> = {
  nueva: 'Nuevas',
  tomada: 'Tomadas',
  atendida: 'Atendidas',
};

export const SEGUIMIENTO_LABELS: Record<string, string> = {
  primera_vez: 'Primera vez',
  seguimiento: 'Seguimiento',
};

const SIN_AREA = 'Sin área';

function etiqueta(map: Record<string, string>, valor: string | null, vacio = '—'): string {
  if (valor === null) return vacio;
  return map[valor] ?? valor;
}

const numero = (n: number) => n.toLocaleString('es-MX');
const decimal = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 });
const redondear = (n: number) => Math.round(n * 10) / 10;

// ── Pivote por estado ───────────────────────────────────────────────────────────────────────────────────────────────

interface Grupo {
  etiquetas: string[];
  conteos: Record<string, number>;
  total: number;
  /** Suma de `metrica × total` y de `total` de las filas que traen métrica (promedio ponderado). */
  sumaMetrica: number;
  pesoMetrica: number;
}

interface PivoteSpec {
  /** Columnas de texto que identifican cada fila de la tabla (área, destino, tipo…). */
  etiquetas: { key: string; header: string; valor: (row: ReporteRow) => string }[];
  /** Estados que se vuelven columnas de conteo, en orden. */
  estados: { valor: string; key: string; header: string }[];
  /** Columnas calculadas al final (tasa, promedio…). */
  extras?: { key: string; header: string; calc: (grupo: Grupo) => number | null }[];
}

function nuevoGrupo(etiquetas: string[]): Grupo {
  return { etiquetas, conteos: {}, total: 0, sumaMetrica: 0, pesoMetrica: 0 };
}

function promedioMetrica(grupo: Grupo): number | null {
  return grupo.pesoMetrica > 0 ? redondear(grupo.sumaMetrica / grupo.pesoMetrica) : null;
}

function pivotar(rows: readonly ReporteRow[], spec: PivoteSpec): { tabla: ReporteTabla; grupos: Grupo[]; total: Grupo } {
  const grupos = new Map<string, Grupo>();
  const total = nuevoGrupo(spec.etiquetas.map(() => ''));
  const acumular = (grupo: Grupo, row: ReporteRow) => {
    const estado = row.estado ?? '';
    grupo.conteos[estado] = (grupo.conteos[estado] ?? 0) + row.total;
    grupo.total += row.total;
    if (row.metrica !== null) {
      grupo.sumaMetrica += row.metrica * row.total;
      grupo.pesoMetrica += row.total;
    }
  };

  for (const row of rows) {
    const etiquetas = spec.etiquetas.map((e) => e.valor(row));
    const clave = etiquetas.join('\u0000');
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = nuevoGrupo(etiquetas);
      grupos.set(clave, grupo);
    }
    acumular(grupo, row);
    acumular(total, row);
  }

  const columnas: ReporteColumna[] = [
    ...spec.etiquetas.map((e) => ({ key: e.key, header: e.header })),
    ...spec.estados.map((e) => ({ key: e.key, header: e.header, numeric: true })),
    { key: 'total', header: 'Total', numeric: true },
    ...(spec.extras ?? []).map((e) => ({ key: e.key, header: e.header, numeric: true })),
  ];

  const aFila = (grupo: Grupo, id: string): ReporteFila => {
    const fila: ReporteFila = { id };
    spec.etiquetas.forEach((e, i) => {
      fila[e.key] = grupo.etiquetas[i];
    });
    for (const estado of spec.estados) fila[estado.key] = grupo.conteos[estado.valor] ?? 0;
    fila.total = grupo.total;
    for (const extra of spec.extras ?? []) fila[extra.key] = extra.calc(grupo);
    return fila;
  };

  const lista = [...grupos.values()];
  const filas = lista.map((grupo, i) => aFila(grupo, `g${i}`));
  if (lista.length > 1) {
    total.etiquetas = spec.etiquetas.map((_, i) => (i === 0 ? 'Total' : ''));
    filas.push(aFila(total, 'total'));
  }
  return { tabla: { columnas, filas }, grupos: lista, total };
}

function porEstado(grupo: Grupo, estados: readonly string[]): number[] {
  return estados.map((estado) => grupo.conteos[estado] ?? 0);
}

// ── Reportes ────────────────────────────────────────────────────────────────────────────────────────────────────────

function atenciones(rows: readonly ReporteRow[]): ReporteVista {
  const columnas: ReporteColumna[] = [
    { key: 'area', header: 'Área' },
    { key: 'tipoAtencion', header: 'Tipo de atención' },
    { key: 'seguimiento', header: 'Primera vez / Seguimiento' },
    { key: 'mujeres', header: 'Mujeres', numeric: true },
    { key: 'hombres', header: 'Hombres', numeric: true },
    { key: 'personas', header: 'Personas', numeric: true },
    { key: 'atenciones', header: 'Atenciones', numeric: true },
  ];
  const filas: ReporteFila[] = rows.map((row, i) => ({
    id: `a${i}`,
    area: row.area ?? SIN_AREA,
    tipoAtencion: row.categoria ?? '—',
    seguimiento: etiqueta(SEGUIMIENTO_LABELS, row.estado),
    mujeres: row.mujeres ?? 0,
    hombres: row.hombres ?? 0,
    personas: row.personas ?? 0,
    atenciones: row.total,
  }));
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const primera = rows.filter((row) => row.estado !== 'seguimiento').reduce((sum, row) => sum + row.total, 0);
  const puntos = distribucionPorTipo(rows);
  return {
    tabla: { columnas, filas },
    kpis: [
      { label: 'Atenciones', value: numero(total) },
      { label: 'Primera vez', value: numero(primera) },
      { label: 'Seguimiento', value: numero(total - primera) },
    ],
    grafica: { kind: 'hbars', titulo: 'Atenciones por tipo de atención', puntos },
    resumenGrafica: resumenPuntos('Atenciones por tipo de atención', puntos),
    vacio: rows.length === 0,
  };
}

const ESTADOS_CITA = ['agendada', 'confirmada', 'reagendada', 'asistio', 'no_asistio', 'cancelada'] as const;

/** Tasa de asistencia: asistió / (asistió + no asistió), en porcentaje con un decimal; `null` si aún no hay cierres. */
export function tasaAsistencia(asistio: number, noAsistio: number): number | null {
  const cerradas = asistio + noAsistio;
  return cerradas > 0 ? redondear((asistio / cerradas) * 100) : null;
}

function citas(rows: readonly ReporteRow[]): ReporteVista {
  const { tabla, total } = pivotar(rows, {
    etiquetas: [{ key: 'area', header: 'Área', valor: (r) => r.area ?? SIN_AREA }],
    estados: ESTADOS_CITA.map((valor) => ({ valor, key: valor, header: ESTADO_CITA_LABELS[valor] })),
    extras: [
      {
        key: 'tasaAsistencia',
        header: 'Tasa de asistencia (%)',
        calc: (g) => tasaAsistencia(g.conteos.asistio ?? 0, g.conteos.no_asistio ?? 0),
      },
    ],
  });
  const valores = porEstado(total, ESTADOS_CITA);
  const labels = ESTADOS_CITA.map((estado) => ESTADO_CITA_LABELS[estado]);
  const tasa = tasaAsistencia(total.conteos.asistio ?? 0, total.conteos.no_asistio ?? 0);
  return {
    tabla,
    kpis: [
      { label: 'Citas', value: numero(total.total) },
      { label: 'Asistieron', value: numero(total.conteos.asistio ?? 0) },
      { label: 'Tasa de asistencia', value: tasa === null ? '—' : `${decimal(tasa)} %` },
    ],
    grafica: { kind: 'barras', titulo: 'Citas por estado', serie: 'Citas', labels, values: valores },
    resumenGrafica: resumenPuntos(
      'Citas por estado',
      labels.map((label, i) => ({ label, value: valores[i] })),
    ),
    vacio: rows.length === 0,
  };
}

const ESTADOS_DERIVACION = ['pendiente', 'en_proceso', 'concluida', 'cancelada'] as const;

function canalizaciones(rows: readonly ReporteRow[]): ReporteVista {
  const { tabla, grupos, total } = pivotar(rows, {
    etiquetas: [
      { key: 'area', header: 'Área de origen', valor: (r) => r.area ?? SIN_AREA },
      { key: 'destino', header: 'Destino', valor: (r) => etiqueta(DESTINO_LABELS, r.categoria) },
    ],
    estados: ESTADOS_DERIVACION.map((valor) => ({ valor, key: valor, header: ESTADO_DERIVACION_LABELS[valor] })),
    extras: [{ key: 'diasPromedio', header: 'Días promedio a conclusión', calc: promedioMetrica }],
  });
  const porDestino = new Map<string, number>();
  for (const grupo of grupos) porDestino.set(grupo.etiquetas[1], (porDestino.get(grupo.etiquetas[1]) ?? 0) + grupo.total);
  const puntos = [...porDestino.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es'));
  const dias = promedioMetrica(total);
  return {
    tabla,
    kpis: [
      { label: 'Canalizaciones', value: numero(total.total) },
      { label: 'Concluidas', value: numero(total.conteos.concluida ?? 0) },
      { label: 'Días promedio a conclusión', value: dias === null ? '—' : decimal(dias) },
    ],
    grafica: { kind: 'hbars', titulo: 'Canalizaciones por destino', puntos },
    resumenGrafica: resumenPuntos('Canalizaciones por destino', puntos),
    vacio: rows.length === 0,
  };
}

const ESTADOS_ORDEN = ['en_tramite', 'vigente', 'vencida', 'cancelada'] as const;

function ordenesProteccion(rows: readonly ReporteRow[]): ReporteVista {
  const { tabla, total } = pivotar(rows, {
    etiquetas: [{ key: 'area', header: 'Área que registró', valor: (r) => r.area ?? SIN_AREA }],
    estados: ESTADOS_ORDEN.map((valor) => ({ valor, key: valor, header: ESTADO_ORDEN_LABELS[valor] })),
  });
  const valores = porEstado(total, ESTADOS_ORDEN);
  const labels = ESTADOS_ORDEN.map((estado) => ESTADO_ORDEN_LABELS[estado]);
  return {
    tabla,
    kpis: [
      { label: 'Órdenes de protección', value: numero(total.total) },
      { label: 'Vigentes', value: numero(total.conteos.vigente ?? 0) },
      { label: 'En trámite', value: numero(total.conteos.en_tramite ?? 0) },
    ],
    grafica: { kind: 'barras', titulo: 'Órdenes de protección por estado', serie: 'Órdenes', labels, values: valores },
    resumenGrafica: resumenPuntos(
      'Órdenes de protección por estado',
      labels.map((label, i) => ({ label, value: valores[i] })),
    ),
    vacio: rows.length === 0,
  };
}

const ESTADOS_ACTIVIDAD = ['pendiente', 'realizada', 'cancelada'] as const;

function actividades(rows: readonly ReporteRow[]): ReporteVista {
  const asistentes = rows.filter((r) => r.estado === 'realizada').reduce((sum, r) => sum + (r.metrica ?? 0), 0);
  const { tabla, grupos, total } = pivotar(rows, {
    etiquetas: [{ key: 'institucion', header: 'Tipo de institución', valor: (r) => etiqueta(TIPO_INSTITUCION_LABELS, r.categoria) }],
    estados: ESTADOS_ACTIVIDAD.map((valor) => ({ valor, key: valor, header: ESTADO_ACTIVIDAD_LABELS[valor] })),
  });
  // Asistentes por tipo de institución: se agregan al pivote porque `metrica` aquí es una SUMA, no un promedio.
  const porInstitucion = new Map<string, number>();
  for (const row of rows) {
    if (row.estado !== 'realizada') continue;
    const clave = etiqueta(TIPO_INSTITUCION_LABELS, row.categoria);
    porInstitucion.set(clave, (porInstitucion.get(clave) ?? 0) + (row.metrica ?? 0));
  }
  const columnas: ReporteColumna[] = [...tabla.columnas, { key: 'asistentes', header: 'Asistentes (realizadas)', numeric: true }];
  const filas: ReporteFila[] = tabla.filas.map((fila) => ({
    ...fila,
    asistentes: fila.id === 'total' ? asistentes : (porInstitucion.get(String(fila.institucion)) ?? 0),
  }));
  const puntos = grupos
    .map((g) => ({ label: g.etiquetas[0], value: g.total }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es'));
  return {
    tabla: { columnas, filas },
    kpis: [
      { label: 'Actividades', value: numero(total.total) },
      { label: 'Realizadas', value: numero(total.conteos.realizada ?? 0) },
      { label: 'Asistentes', value: numero(asistentes) },
    ],
    grafica: { kind: 'hbars', titulo: 'Actividades por tipo de institución', puntos },
    resumenGrafica: resumenPuntos('Actividades por tipo de institución', puntos),
    vacio: rows.length === 0,
  };
}

const ESTADOS_ALERTA = ['nueva', 'tomada', 'atendida'] as const;

function alertas(rows: readonly ReporteRow[]): ReporteVista {
  const { tabla, grupos, total } = pivotar(rows, {
    etiquetas: [{ key: 'origen', header: 'Origen', valor: (r) => etiqueta(ORIGEN_ALERTA_LABELS, r.categoria) }],
    estados: ESTADOS_ALERTA.map((valor) => ({ valor, key: valor, header: ESTADO_ALERTA_LABELS[valor] })),
    extras: [{ key: 'minutosPromedio', header: 'Minutos promedio de atención', calc: promedioMetrica }],
  });
  const puntos = grupos
    .map((g) => ({ label: g.etiquetas[0], value: g.total }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es'));
  const minutos = promedioMetrica(total);
  return {
    tabla,
    kpis: [
      { label: 'Alertas', value: numero(total.total) },
      { label: 'Atendidas', value: numero(total.conteos.atendida ?? 0) },
      { label: 'Minutos promedio de atención', value: minutos === null ? '—' : decimal(minutos) },
    ],
    grafica: { kind: 'hbars', titulo: 'Alertas por origen', puntos },
    resumenGrafica: resumenPuntos('Alertas por origen', puntos),
    vacio: rows.length === 0,
  };
}

export const REPORTES: Record<ReporteTipo, ReporteDef> = {
  atenciones: {
    tipo: 'atenciones',
    label: 'Atenciones',
    descripcion: 'Atenciones por área y tipo de atención, primera vez o seguimiento, y personas por sexo.',
    aplicaArea: true,
    construir: atenciones,
  },
  citas: {
    tipo: 'citas',
    label: 'Citas',
    descripcion: 'Citas agendadas, confirmadas, a las que asistieron o no, y canceladas, con la tasa de asistencia.',
    aplicaArea: true,
    construir: citas,
  },
  canalizaciones: {
    tipo: 'canalizaciones',
    label: 'Canalizaciones',
    descripcion: 'Canalizaciones por destino y estado, con el tiempo promedio hasta su conclusión.',
    aplicaArea: true,
    construir: canalizaciones,
  },
  ordenes_proteccion: {
    tipo: 'ordenes_proteccion',
    label: 'Órdenes de protección',
    descripcion: 'Órdenes de protección por estado, según el área que las registró.',
    aplicaArea: true,
    construir: ordenesProteccion,
  },
  actividades: {
    tipo: 'actividades',
    label: 'Actividades preventivas',
    descripcion: 'Actividades realizadas, pendientes y canceladas, con asistentes, por tipo de institución. Abarca todo el programa.',
    aplicaArea: false,
    construir: actividades,
  },
  alertas: {
    tipo: 'alertas',
    label: 'Alertas',
    descripcion: 'Alertas por origen y estado, con el tiempo promedio de atención. Abarca todo el programa.',
    aplicaArea: false,
    construir: alertas,
  },
};

export const REPORTE_OPCIONES = REPORTE_TIPOS.map((tipo) => ({ value: tipo, label: REPORTES[tipo].label }));

export function esReporteTipo(value: string): value is ReporteTipo {
  return (REPORTE_TIPOS as readonly string[]).includes(value);
}
