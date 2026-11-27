import type { DataAction, DataTableProps } from '@yewdiel21/motion-kit/react';
import { createRowDecorator, type PillColumnSpec, type RowDecorSpec } from '@/shared/ui/table/tableDecorate';
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
  { value: 'Urgente', label: 'Urgente' },
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
  { id: 'prioritarios', label: 'Urgentes' },
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

const ESTADO_PILL: PillColumnSpec = {
  tones: { Abierto: 'info', 'En seguimiento': 'warning', Cerrado: 'success' },
};

const URGENCIA_PILL: PillColumnSpec = {
  tones: { Urgente: 'danger', Normal: 'neutral' },
};

/**
 * Presentación de la tabla (cápsulas de estado y prioridad, folio y nombre destacados, filas enfocables). Constante de
 * módulo: `VcDataTable` la recibe como props y construye su decorador una sola vez.
 * Sin `data-mk-shared`: hacer viajar nombre y folio al panel costaba la mitad de los frames al abrir.
 */
export const EXPEDIENTES_DECOR = {
  pills: { estado: ESTADO_PILL, urgencia: URGENCIA_PILL },
  strong: ['nombreCompleto'],
  mono: ['folio', 'curp'],
  interactive: true,
} satisfies RowDecorSpec;

/** Decorador de filas (el mismo que aplica `VcDataTable`; exportado para pruebas). */
export const decorateExpedienteRows = createRowDecorator(EXPEDIENTES_DECOR);
