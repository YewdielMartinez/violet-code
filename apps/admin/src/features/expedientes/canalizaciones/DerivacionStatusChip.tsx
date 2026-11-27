import {
  ESTADO_DERIVACION_LABELS,
  type EstadoDerivacion,
} from '@/features/canalizaciones/api';
import './canalizaciones.css';

const ESTADO_CHIP_STYLE: Record<EstadoDerivacion, { badge: string; dot: string }> = {
  pendiente: { badge: 'bg-status-warning-bg text-status-warning', dot: 'bg-status-warning' },
  en_proceso: { badge: 'bg-status-info-bg text-status-info', dot: 'bg-status-info' },
  concluida: { badge: 'bg-status-success-bg text-status-success', dot: 'bg-status-success' },
  cancelada: { badge: 'bg-status-danger-bg text-status-danger', dot: 'bg-status-danger' },
};

export function getEstadoDotClass(estado: EstadoDerivacion): string {
  return ESTADO_CHIP_STYLE[estado].dot;
}

interface DerivacionStatusChipProps {
  estado: EstadoDerivacion;
  /** Reproduce la animación de «pop» (al montarse tras un cambio de estado). */
  pop?: boolean;
}

export function DerivacionStatusChip({ estado, pop = false }: DerivacionStatusChipProps) {
  const style = ESTADO_CHIP_STYLE[estado];
  return (
    <span
      className={`vc-canal-chip ${style.badge}`}
      data-estado={estado}
      data-pop={pop ? '' : undefined}
    >
      <span aria-hidden="true" className="vc-canal-chip__dot" />
      <span>{ESTADO_DERIVACION_LABELS[estado]}</span>
    </span>
  );
}
