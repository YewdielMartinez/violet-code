import type { DataAction, DataTableProps } from '@yewdiel21/motion-kit/react';
import {
  ESTADO_DERIVACION_LABELS,
  ESTADOS_DERIVACION,
  type EstadoDerivacion,
} from './api';

export type EstadoFilter = 'todos' | EstadoDerivacion;

export interface DerivacionRow extends Record<string, unknown> {
  id: string;
  folio: string;
  usuariaNombre: string;
  origenLabel: string;
  destinoLabel: string;
  detalleDestino: string;
  estadoLabel: string;
  fechaDerivacion: string;
}

const ESTADO_OPTIONS = ESTADOS_DERIVACION.map((e) => ({
  value: ESTADO_DERIVACION_LABELS[e],
  label: ESTADO_DERIVACION_LABELS[e],
}));

export const CANALIZACIONES_COLUMNS: DataTableProps<DerivacionRow>['columns'] = [
  { key: 'folio', label: 'Folio', sortable: true, searchable: true },
  { key: 'usuariaNombre', label: 'Usuaria', sortable: true, searchable: true },
  { key: 'origenLabel', label: 'Origen', sortable: true },
  { key: 'destinoLabel', label: 'Destino', sortable: true, searchable: true },
  { key: 'detalleDestino', label: 'Área / Institución', searchable: true },
  {
    key: 'estadoLabel',
    label: 'Estado',
    type: 'select',
    filterable: true,
    options: ESTADO_OPTIONS,
  },
  { key: 'fechaDerivacion', label: 'Fecha', sortable: true },
];

export const CANALIZACIONES_ROW_ACTIONS: DataAction[] = [
  { id: 'ver', label: 'Ver detalle' },
  { id: 'en_proceso', label: 'Marcar en proceso' },
  { id: 'concluida', label: 'Marcar concluida' },
  { id: 'cancelada', label: 'Cancelar canalización', danger: true },
];

export const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

export const QUICK_FILTERS: { id: EstadoFilter; label: string }[] = [
  { id: 'todos', label: 'Todas' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'en_proceso', label: 'En proceso' },
  { id: 'concluida', label: 'Concluidas' },
  { id: 'cancelada', label: 'Canceladas' },
];

type PillTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const CANALIZACION_ESTADO_TONES: Record<string, PillTone> = {
  Pendiente: 'warning',
  'En proceso': 'info',
  Concluida: 'success',
  Cancelada: 'danger',
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

export function decorateCanalizacionRows(tbody: HTMLTableSectionElement) {
  for (const tr of tbody.querySelectorAll<HTMLTableRowElement>('tr[data-id]')) {
    if (tr.hasAttribute('data-mk-dt-loading') || tr.dataset.vcDecorated === '1') continue;
    tr.tabIndex = 0;
    tr.style.cursor = 'pointer';
    decoratePillCell(
      tr.querySelector<HTMLTableCellElement>('td[data-key="estadoLabel"]'),
      CANALIZACION_ESTADO_TONES,
    );
    tr.dataset.vcDecorated = '1';
  }
}
