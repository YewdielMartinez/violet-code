import type { DataAction, DataTableProps } from '@yewdiel21/motion-kit/react';
import { esVencida } from '@/domain/models/ActividadEstado';
import {
  ESTADO_ACTIVIDAD_LABELS,
  NIVEL_EDUCATIVO_LABELS,
  TIPO_INSTITUCION_LABELS,
  type ActividadPreventivaItem,
} from '@/domain/models/ActividadPreventiva';
import { fechaCortaActividad, horaActividad, ubicacionActividad } from './actividadesList';

export interface ActividadRow extends Record<string, unknown> {
  id: string;
  /** ISO de la fecha programada: el kit ordena por este valor (la etiqueta es solo texto). */
  programadaEn: string;
  fechaLabel: string;
  titulo: string;
  sede: string;
  ubicacion: string;
  institucion: string;
  tipoActividad: string;
  /** «Pendiente», «Realizada» o «Cancelada» (el chip «Vencida» se añade con `vencida`). */
  estado: string;
  vencida: boolean;
  asistentes: number | null;
}

/** Separador entre las cápsulas de una misma celda de estado («Pendiente · Vencida»). */
const PILL_SEPARATOR = ' · ';
const VENCIDA_LABEL = 'Vencida';

const ESTADO_OPTIONS = Object.values(ESTADO_ACTIVIDAD_LABELS).map((label) => ({ value: label, label }));

// Configuraciones estáticas fuera del componente para preservar referencias en motion-kit.
export const COLUMNS: DataTableProps<ActividadRow>['columns'] = [
  {
    key: 'programadaEn',
    label: 'Fecha',
    type: 'date',
    sortable: true,
    format: (_value, row) => row.fechaLabel,
  },
  { key: 'titulo', label: 'Título', sortable: true, searchable: true },
  { key: 'sede', label: 'Sede', sortable: true, searchable: true },
  { key: 'ubicacion', label: 'Ubicación', sortable: true, searchable: true },
  { key: 'institucion', label: 'Institución', sortable: true },
  { key: 'tipoActividad', label: 'Tipo de actividad', sortable: true },
  {
    key: 'estado',
    label: 'Estado',
    type: 'select',
    filterable: true,
    options: ESTADO_OPTIONS,
    format: (value, row) => (row.vencida ? `${String(value)}${PILL_SEPARATOR}${VENCIDA_LABEL}` : String(value)),
  },
  {
    key: 'asistentes',
    label: 'Asistentes',
    type: 'number',
    sortable: true,
    align: 'end',
    format: (value) => (typeof value === 'number' ? String(value) : '—'),
  },
];

export const ROW_ACTIONS: DataAction[] = [{ id: 'open', label: 'Ver detalle' }];
export const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

/** Fila de la tabla a partir de una actividad (el reloj `ahora` decide si una pendiente está vencida). */
export function toActividadRow(item: ActividadPreventivaItem, ahora: Date): ActividadRow {
  return {
    id: item.id,
    programadaEn: item.programadaEn,
    fechaLabel: `${fechaCortaActividad(item.programadaEn)} · ${horaActividad(item.programadaEn)}`,
    titulo: item.titulo,
    sede: item.sede,
    ubicacion: ubicacionActividad(item) ?? '—',
    institucion:
      TIPO_INSTITUCION_LABELS[item.tipoInstitucion] +
      (item.nivelEducativo ? ` · ${NIVEL_EDUCATIVO_LABELS[item.nivelEducativo]}` : ''),
    tipoActividad: item.tipoActividadNombre,
    estado: ESTADO_ACTIVIDAD_LABELS[item.estado],
    vencida: esVencida(item, ahora),
    asistentes: item.numeroAsistentes,
  };
}

type PillTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const ESTADO_TONES: Record<string, PillTone> = {
  [ESTADO_ACTIVIDAD_LABELS.pendiente]: 'info',
  [ESTADO_ACTIVIDAD_LABELS.realizada]: 'success',
  [ESTADO_ACTIVIDAD_LABELS.cancelada]: 'danger',
  [VENCIDA_LABEL]: 'warning',
};

function buildPill(label: string, tone: PillTone): HTMLSpanElement {
  const pill = document.createElement('span');
  pill.className = `vc-dt-pill vc-dt-pill--${tone}`;

  const dot = document.createElement('span');
  dot.className = 'vc-dt-pill__dot';
  dot.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = label;

  pill.append(dot, text);
  return pill;
}

/**
 * Reemplaza el texto de una celda por cápsulas (mismo `vc-dt-pill` que Expedientes y Usuarios). Con `split`, cada
 * fragmento separado por « · » es una cápsula (estado + «Vencida»). Es idempotente por celda: si el kit reescribe la
 * celda (búsqueda, ordenación), se vuelve a decorar.
 */
function decoratePillCell(td: HTMLTableCellElement | null, tones: Record<string, PillTone>, split: boolean): void {
  if (!td || td.querySelector('.vc-dt-pill')) return;
  const text = (td.textContent ?? '').trim();
  if (!text) return;

  const labels = split ? text.split(PILL_SEPARATOR) : [text];
  const wrap = document.createElement('span');
  wrap.className = 'vc-act-pills';
  for (const label of labels) wrap.append(buildPill(label, tones[label] ?? 'neutral'));
  td.replaceChildren(wrap);
}

/** Hace enfocables (Tab + Enter) las filas y decora estado e institución con cápsulas. */
export function decorateActividadRows(tbody: HTMLTableSectionElement): void {
  for (const tr of tbody.rows) {
    if (!tr.dataset.id || tr.hasAttribute('data-mk-dt-loading')) continue;
    tr.tabIndex = 0;
    decoratePillCell(tr.querySelector<HTMLTableCellElement>('td[data-key="estado"]'), ESTADO_TONES, true);
    decoratePillCell(tr.querySelector<HTMLTableCellElement>('td[data-key="institucion"]'), {}, false);
  }
}
