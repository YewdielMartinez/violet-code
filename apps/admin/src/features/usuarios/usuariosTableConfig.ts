import type { DataAction, DataTableProps } from '@yewdiel21/motion-kit/react';
import { ESTADO_CUENTA_LABELS, ROLE_LABELS, ROLES_ASIGNABLES } from '@/domain/models/Usuario';
import { formatTableDate } from '@/features/expedientes/drawer/expedientesTableConfig';
import { createRowDecorator, type RowDecorSpec } from '@/shared/ui/table/tableDecorate';

export { formatTableDate };

export type UsuariosQuickFilter = 'todos' | 'activos' | 'inactivos';

/** Filtro por rol, independiente del estado: «umeca» muestra solo las cuentas con rol UMECA. */
export type UsuariosRolFilter = 'todos' | 'umeca';

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
];

export const ROL_FILTERS: { id: UsuariosRolFilter; label: string }[] = [
  { id: 'todos', label: 'Todos los roles' },
  { id: 'umeca', label: 'UMECA' },
];

/** Presentación de la tabla: cápsula de estado, nombre destacado y filas enfocables (ver `VcDataTable`). */
export const USUARIOS_DECOR = {
  pills: {
    estado: {
      tones: {
        [ESTADO_CUENTA_LABELS.activo]: 'success',
        [ESTADO_CUENTA_LABELS.inactivo]: 'neutral',
      },
    },
  },
  strong: ['nombreCompleto'],
  interactive: true,
} satisfies RowDecorSpec;

/** Decorador de filas (el mismo que aplica `VcDataTable`; exportado para pruebas). */
export const decorateUsuarioRows = createRowDecorator(USUARIOS_DECOR);
