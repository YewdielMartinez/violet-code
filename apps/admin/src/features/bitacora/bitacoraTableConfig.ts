import type { DataTableProps } from '@yewdiel21/motion-kit/react';
import { ROLE_LABELS, type StaffRole } from '@/domain/models/Auth';
import {
  accionBitacoraLabel,
  tablaBitacoraLabel,
  type AccionBitacora,
  type BitacoraEvento,
} from '@/domain/models/Bitacora';
import { createRowDecorator, type RowDecorSpec } from '@/shared/ui/table/tableDecorate';
import { fechaHoraBitacora } from './bitacoraList';

export interface BitacoraRow extends Record<string, unknown> {
  id: string;
  fechaLabel: string;
  actor: string;
  rol: string;
  tabla: string;
  accion: string;
  registro: string;
}

/** Rol del personal o dependencia de la cuenta externa, con el nombre que ve Dirección en el resto del panel. */
export function actorRolLabel(rol: string | null): string {
  if (!rol) return '—';
  return ROLE_LABELS[rol as StaffRole] ?? rol;
}

export function toBitacoraRow(evento: BitacoraEvento): BitacoraRow {
  return {
    id: evento.id,
    fechaLabel: fechaHoraBitacora(evento.creadoEn),
    actor: evento.actorNombre,
    rol: actorRolLabel(evento.actorRol),
    tabla: tablaBitacoraLabel(evento.tabla),
    accion: accionBitacoraLabel(evento.accion),
    registro: evento.registroId ?? '—',
  };
}

// Configuraciones estáticas fuera del componente para preservar referencias en motion-kit.
// El orden lo fija el servidor (más reciente primero): las columnas no son ordenables.
export const COLUMNS: DataTableProps<BitacoraRow>['columns'] = [
  { key: 'fechaLabel', label: 'Fecha y hora' },
  { key: 'actor', label: 'Quién' },
  { key: 'rol', label: 'Rol' },
  { key: 'tabla', label: 'Tabla' },
  { key: 'accion', label: 'Acción' },
  { key: 'registro', label: 'Registro' },
];

export const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

/**
 * Presentación de la tabla de solo lectura: quién hizo el cambio destacado, acción como cápsula, id del registro en
 * monoespaciada y truncado (el id completo queda en el `title`). Las filas no son interactivas.
 */
export const BITACORA_DECOR = {
  pills: {
    accion: {
      tones: {
        [accionBitacoraLabel('ver' satisfies AccionBitacora)]: 'info',
        [accionBitacoraLabel('crear' satisfies AccionBitacora)]: 'success',
        [accionBitacoraLabel('actualizar' satisfies AccionBitacora)]: 'warning',
        [accionBitacoraLabel('desactivar' satisfies AccionBitacora)]: 'danger',
      },
    },
  },
  strong: ['actor'],
  mono: ['registro'],
  muted: ['rol', 'fechaLabel'],
  truncate: ['registro'],
} satisfies RowDecorSpec;

/** Decorador de filas (el mismo que aplica `VcDataTable`; exportado para pruebas). */
export const decorateBitacoraRows = createRowDecorator(BITACORA_DECOR);
