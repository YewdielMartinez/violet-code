import { useState } from 'react';
import {
  ESTADO_CITA_LABELS,
  PRIORIDAD_CITA_LABELS,
  type AgendaItem,
  type EstadoCita,
  type PrioridadNivel,
} from '@/domain/models/Cita';
import { Icon } from '@/shared/ui/Icon';
import { ESTADO_CHIP_CLASS, UMECA_BADGE_LABEL, esCitaUmeca } from './citaDialogUtils';

/**
 * Chip de estado: al cambiar de estado se vuelve a montar y «salta» (animación `vc-cita-pop`).
 * La forma (alto, padding, radio, tipografía) vive en `.vc-cita-chip` para que estado y prioridad sean idénticos;
 * aquí solo se elige el color (tokens semánticos, válidos en claro y oscuro).
 */
export function CitaEstadoChip({ estado }: { estado: EstadoCita }) {
  const [seen, setSeen] = useState({ estado, changes: 0 });
  if (seen.estado !== estado) setSeen({ estado, changes: seen.changes + 1 });

  return (
    <span
      key={seen.changes}
      data-estado={estado}
      className={`vc-cita-chip ${seen.changes > 0 ? 'vc-cita-chip--pop' : ''} ${ESTADO_CHIP_CLASS[estado]}`}
    >
      {ESTADO_CITA_LABELS[estado]}
    </span>
  );
}

const PRIORIDAD_CLASS: Record<PrioridadNivel, string> = {
  alta: 'bg-status-danger-bg text-status-danger',
  media: 'bg-status-warning-bg text-status-warning',
  baja: 'bg-surface-container-high text-on-surface-variant',
};

/** Chip de prioridad operativa; con `vacio` y sin prioridad muestra «Sin prioridad» en neutro en lugar de omitirse. */
export function CitaPrioridadChip({ prioridad, vacio = false }: { prioridad: PrioridadNivel | null; vacio?: boolean }) {
  if (!prioridad) {
    return vacio ? <span className="vc-cita-chip bg-surface-container-high text-on-surface-variant">Sin prioridad</span> : null;
  }
  return (
    <span className={`vc-cita-chip ${PRIORIDAD_CLASS[prioridad]}`}>
      Prioridad {PRIORIDAD_CITA_LABELS[prioridad].toLowerCase()}
    </span>
  );
}

/**
 * Insignia UMECA: la cita es de una mujer con asistencia ordenada por un juzgado (origen `umeca`).
 * Tonal (tertiary-container) y con ícono, para no depender solo del color; no renderiza nada si la cita es regular.
 */
export function CitaUmecaBadge({ cita }: { cita: Pick<AgendaItem, 'origen'> }) {
  if (!esCitaUmeca(cita)) return null;
  return (
    <span className="vc-cita-chip gap-1.5 bg-tertiary-container text-on-tertiary-container" data-origen="umeca">
      <Icon name="gavel" className="text-[16px]" />
      {UMECA_BADGE_LABEL}
    </span>
  );
}
