import type { DataAction, DataTableProps } from '@yewdiel21/motion-kit/react';
import { ESTADO_CUENTA_LABELS, ROLE_LABELS, ROLES_ASIGNABLES } from '@/domain/models/Usuario';
import { formatTableDate } from '@/features/expedientes/drawer/expedientesTableConfig';

export { formatTableDate };

export type UsuariosQuickFilter = 'todos' | 'activos' | 'inactivos' | 'externos';

export interface UsuarioRow extends Record<string, unknown> {
  id: string;
  nombreCompleto: string;
  rol: string;
  area: string;
  estado: string;
  altaLabel: string;
}

const ROL_OPTIONS = ROLES_ASIGNABLES.map((rol) => ({ value: ROLE_LABELS[rol], label: ROLE_LABELS[rol] }));
const ESTADO_OPTIONS = Object.values(ESTADO_CUENTA_LABELS).map((label) => ({ value: label, label }));

// Configuraciones estáticas fuera del componente para preservar referencias en motion-kit.
export const COLUMNS: DataTableProps<UsuarioRow>['columns'] = [
  { key: 'nombreCompleto', label: 'Nombre', sortable: true, searchable: true },
  { key: 'rol', label: 'Rol', type: 'select', filterable: true, sortable: true, options: ROL_OPTIONS },
  { key: 'area', label: 'Área', sortable: true },
  { key: 'estado', label: 'Estado', type: 'select', filterable: true, options: ESTADO_OPTIONS },
  { key: 'altaLabel', label: 'Alta', sortable: true },
];

export const ROW_ACTIONS: DataAction[] = [
  { id: 'edit', label: 'Editar cuenta' },
  { id: 'toggle', label: 'Activar / desactivar' },
];
export const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

export const QUICK_FILTERS: { id: UsuariosQuickFilter; label: string }[] = [
  { id: 'todos', label: 'Todas' },
  { id: 'activos', label: 'Activas' },
  { id: 'inactivos', label: 'Inactivas' },
  { id: 'externos', label: 'Externas (UMECA)' },
];

type PillTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const ESTADO_TONES: Record<string, PillTone> = {
  [ESTADO_CUENTA_LABELS.activo]: 'success',
  [ESTADO_CUENTA_LABELS.inactivo]: 'neutral',
};

/** Mismo decorado de cápsulas que la tabla de Expedientes (`vc-dt-pill`). */
function decoratePillCell(td: HTMLTableCellElement | null, tones: Record<string, PillTone>): void {
  if (!td || td.querySelector('.vc-dt-pill')) return;
  const rawText = td.textContent ?? '';
  const key = rawText.trim();
  if (!key) return;

  const pill = document.createElement('span');
  pill.className = `vc-dt-pill vc-dt-pill--${tones[key] ?? 'neutral'}`;
  const dot = document.createElement('span');
  dot.className = 'vc-dt-pill__dot';
  dot.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = rawText;
  pill.append(dot, label);
  td.replaceChildren(pill);
}

/** Hace enfocables (Tab + Enter) las filas y decora el estado con cápsulas, una sola vez por fila. */
export function decorateUsuarioRows(tbody: HTMLTableSectionElement): void {
  for (const tr of tbody.rows) {
    if (!tr.dataset.id || tr.hasAttribute('data-mk-dt-loading')) continue;
    if (tr.dataset.vcDecorated === '1') continue;
    tr.tabIndex = 0;
    decoratePillCell(tr.querySelector<HTMLTableCellElement>('td[data-key="estado"]'), ESTADO_TONES);
    tr.dataset.vcDecorated = '1';
  }
}
