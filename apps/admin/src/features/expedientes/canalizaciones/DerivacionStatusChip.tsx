import { Icon } from '@/shared/ui/Icon';
import {
  ESTADO_DERIVACION_LABELS,
  type EstadoDerivacion,
} from '@/features/canalizaciones/api';

const ESTADO_CHIP_STYLE: Record<
  EstadoDerivacion,
  { badge: string; dot: string; icon: string }
> = {
  pendiente: {
    badge: 'bg-status-warning-bg text-status-warning',
    dot: 'bg-status-warning',
    icon: 'schedule',
  },
  en_proceso: {
    badge: 'bg-status-info-bg text-status-info',
    dot: 'bg-status-info',
    icon: 'autorenew',
  },
  concluida: {
    badge: 'bg-status-success-bg text-status-success',
    dot: 'bg-status-success',
    icon: 'check_circle',
  },
  cancelada: {
    badge: 'bg-status-danger-bg text-status-danger',
    dot: 'bg-status-danger',
    icon: 'cancel',
  },
};

export function getEstadoDotClass(estado: EstadoDerivacion): string {
  return ESTADO_CHIP_STYLE[estado].dot;
}

export function DerivacionStatusChip({ estado }: { estado: EstadoDerivacion }) {
  const style = ESTADO_CHIP_STYLE[estado];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}
    >
      <Icon name={style.icon} className="text-[14px]" />
      <span>{ESTADO_DERIVACION_LABELS[estado]}</span>
    </span>
  );
}
