import type { DataTableProps } from '@yewdiel21/motion-kit/react';
import { ROLE_LABELS, type StaffRole } from '@/domain/models/Auth';
import {
  accionBitacoraLabel,
  tablaBitacoraLabel,
  type AccionBitacora,
  type BitacoraEvento,
} from '@/domain/models/Bitacora';
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

type PillTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const ACCION_TONES: Record<string, PillTone> = {
  [accionBitacoraLabel('ver' satisfies AccionBitacora)]: 'info',
  [accionBitacoraLabel('crear' satisfies AccionBitacora)]: 'success',
  [accionBitacoraLabel('actualizar' satisfies AccionBitacora)]: 'warning',
  [accionBitacoraLabel('desactivar' satisfies AccionBitacora)]: 'danger',
};

/** Cápsula `vc-dt-pill` (mismo diseño que Expedientes, Usuarios y Actividades), una sola vez por celda. */
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

/** Decora la acción con cápsulas. La bitácora es de solo lectura: las filas no son interactivas. */
export function decorateBitacoraRows(tbody: HTMLTableSectionElement): void {
  for (const tr of tbody.rows) {
    if (!tr.dataset.id || tr.hasAttribute('data-mk-dt-loading')) continue;
    decoratePillCell(tr.querySelector<HTMLTableCellElement>('td[data-key="accion"]'), ACCION_TONES);
  }
}
