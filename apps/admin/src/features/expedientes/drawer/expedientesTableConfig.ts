import type { DataAction, DataTableProps } from '@yewdiel21/motion-kit/react';
import { ESTADO_FICHA_LABELS } from '../api';

export type QuickFilter = 'todos' | 'abierto' | 'en_seguimiento' | 'prioritarios' | 'cerrado' | 'archivado';

export interface ExpedienteRow extends Record<string, unknown> {
  id: string;
  folio: string;
  nombreCompleto: string;
  curp: string;
  estado: string;
  urgencia: string;
  actualizadoLabel: string;
}

const ESTADO_OPTIONS = Object.entries(ESTADO_FICHA_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const URGENCIA_OPTIONS = [
  { value: 'Prioritario', label: 'Prioritario' },
  { value: 'Normal', label: 'Normal' },
];

// Configuraciones estáticas fuera del componente para preservar referencias en motion-kit.
export const COLUMNS: DataTableProps<ExpedienteRow>['columns'] = [
  { key: 'folio', label: 'Folio', sortable: true, searchable: true },
  { key: 'nombreCompleto', label: 'Usuaria', sortable: true, searchable: true },
  { key: 'curp', label: 'CURP', sortable: true, searchable: true },
  {
    key: 'estado',
    label: 'Estado',
    type: 'select',
    filterable: true,
    options: ESTADO_OPTIONS,
  },
  {
    key: 'urgencia',
    label: 'Prioridad',
    type: 'select',
    filterable: true,
    options: URGENCIA_OPTIONS,
  },
  { key: 'actualizadoLabel', label: 'Actualizado', sortable: true },
];

export const ROW_ACTIONS: DataAction[] = [{ id: 'open', label: 'Abrir expediente' }];
const ARCHIVE_ACTION: DataAction = { id: 'archive', label: 'Archivar expediente' };
const REOPEN_ACTION: DataAction = { id: 'reopen', label: 'Desarchivar expediente' };

/** Con «Archivar expediente» (roles con capacidad de gestión). */
export const ROW_ACTIONS_WITH_ARCHIVE: DataAction[] = [...ROW_ACTIONS, ARCHIVE_ACTION];
/** Con «Archivar» y «Desarchivar» (`expediente.reabrir`: solo titular y subdirección). */
export const ROW_ACTIONS_WITH_ARCHIVE_AND_REOPEN: DataAction[] = [
  ...ROW_ACTIONS,
  ARCHIVE_ACTION,
  REOPEN_ACTION,
];export const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

export const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'abierto', label: 'Abiertos' },
  { id: 'en_seguimiento', label: 'En seguimiento' },
  { id: 'prioritarios', label: 'Prioritarios' },
  { id: 'cerrado', label: 'Cerrados' },
  { id: 'archivado', label: 'Archivados' },
];

const TABLE_DATE_FMT = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function formatTableDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : TABLE_DATE_FMT.format(date);
}

type PillTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const ESTADO_TONES: Record<string, PillTone> = {
  Abierto: 'info',
  'En seguimiento': 'warning',
  Cerrado: 'success',
};

const URGENCIA_TONES: Record<string, PillTone> = {
  Prioritario: 'danger',
  Normal: 'neutral',
};

/** Reemplaza el texto plano de una celda por una cápsula visual preservando su `textContent`. */
function decoratePillCell(
  td: HTMLTableCellElement | null,
  tones: Record<string, PillTone>,
): void {
  if (!td || td.querySelector('.vc-dt-pill')) return;
  const rawText = td.textContent ?? '';
  const key = rawText.trim();
  if (!key) return;

  const tone = tones[key] ?? 'neutral';
  const pill = document.createElement('span');
  pill.className = `vc-dt-pill vc-dt-pill--${tone}`;

  const dot = document.createElement('span');
  dot.className = 'vc-dt-pill__dot';
  dot.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.textContent = rawText;

  pill.append(dot, label);
  td.replaceChildren(pill);
}

/**
 * Hace enfocables (Tab + Enter) las filas de la tabla y decora estado/prioridad con cápsulas, una sola vez por fila.
 * Sin `data-mk-shared`: hacer viajar nombre y folio al panel costaba la mitad de los frames al abrir.
 */
export function decorateExpedienteRows(tbody: HTMLTableSectionElement): void {
  for (const tr of tbody.rows) {
    if (!tr.dataset.id || tr.hasAttribute('data-mk-dt-loading')) continue;
    if (tr.dataset.vcDecorated === '1') continue;
    tr.tabIndex = 0;
    decoratePillCell(tr.querySelector<HTMLTableCellElement>('td[data-key="estado"]'), ESTADO_TONES);
    decoratePillCell(
      tr.querySelector<HTMLTableCellElement>('td[data-key="urgencia"]'),
      URGENCIA_TONES,
    );
    tr.dataset.vcDecorated = '1';
  }
}
