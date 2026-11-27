import type { DataAction, DataTableProps } from '@yewdiel21/motion-kit/react';
import { createRowDecorator, type RowDecorSpec } from '@/shared/ui/table/tableDecorate';
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

/** Presentación de la tabla: folio monoespaciado, usuaria destacada, estado como cápsula y filas enfocables. */
export const CANALIZACIONES_DECOR = {
  pills: {
    estadoLabel: {
      tones: { Pendiente: 'warning', 'En proceso': 'info', Concluida: 'success', Cancelada: 'danger' },
    },
  },
  strong: ['usuariaNombre'],
  mono: ['folio'],
  truncate: ['detalleDestino'],
  interactive: true,
} satisfies RowDecorSpec;

/** Decorador de filas (el mismo que aplica `VcDataTable`; exportado para pruebas). */
export const decorateCanalizacionRows = createRowDecorator(CANALIZACIONES_DECOR);
