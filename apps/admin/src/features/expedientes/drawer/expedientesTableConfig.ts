import type { DataAction, DataTableProps } from '@yewdiel21/motion-kit/react';
import { ESTADO_FICHA_LABELS } from '../api';

export type QuickFilter = 'todos' | 'abierto' | 'en_seguimiento' | 'prioritarios' | 'cerrado';

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
export const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

export const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'abierto', label: 'Abiertos' },
  { id: 'en_seguimiento', label: 'En seguimiento' },
  { id: 'prioritarios', label: 'Prioritarios' },
  { id: 'cerrado', label: 'Cerrados' },
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

const SHARED_CELL_KEYS: ReadonlyArray<readonly [key: string, sharedName: string]> = [
  ['folio', 'expediente-folio'],
  ['nombreCompleto', 'expediente-nombre'],
];

/**
 * Marca filas enfocables y envuelve el texto completo de Folio/Usuaria para que
 * `data-mk-shared` viaje íntegro incluso cuando DataTable inserta `<mark>` de búsqueda.
 */
export function decorateExpedienteRows(tbody: HTMLTableSectionElement): void {
  for (const tr of tbody.rows) {
    if (!tr.dataset.id || tr.hasAttribute('data-mk-dt-loading')) continue;
    tr.tabIndex = 0;

    for (const [key, sharedName] of SHARED_CELL_KEYS) {
      const td = tr.querySelector<HTMLTableCellElement>(`td[data-key="${key}"]`);
      if (!td) continue;

      td.setAttribute('data-mk-shared', sharedName);
      if (td.querySelector('[data-vc-shared-wrap]')) continue;

      const wrapper = document.createElement('span');
      wrapper.dataset.vcSharedWrap = '';
      wrapper.append(...td.childNodes);
      td.append(wrapper);
    }
  }
}
