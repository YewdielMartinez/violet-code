import {
  ESTADO_ACTIVIDAD_LABELS,
  NIVEL_EDUCATIVO_LABELS,
  TIPO_INSTITUCION_LABELS,
  type EstadoActividad,
  type TipoInstitucionActividad,
} from '@/domain/models/ActividadPreventiva';
import { Icon } from '@/shared/ui/Icon';
import { StatusChip } from '@/shared/ui/StatusChip';

export const TIPO_INSTITUCION_ICON: Record<TipoInstitucionActividad, string> = {
  escuela: 'school',
  empresa_privada: 'business',
  sector_publico: 'account_balance',
  comunidad: 'groups',
  otro: 'location_on',
};

/** Color por estado (mismos tokens que los chips de estado de la Agenda: info / éxito / peligro). */
export const ESTADO_TONE: Record<EstadoActividad, string> = {
  pendiente: 'bg-secondary-container text-on-secondary-container',
  realizada: 'bg-status-success-bg text-status-success',
  cancelada: 'bg-status-danger-bg text-status-danger',
};

const NEUTRAL_TONE = 'bg-surface-container-high text-on-surface-variant';

/** Chip de estado: al cambiar de estado se vuelve a montar y «salta». */
export function ActividadEstadoChip({ estado }: { estado: EstadoActividad }) {
  return (
    <StatusChip value={estado} tone={ESTADO_TONE[estado]} data-estado={estado}>
      {ESTADO_ACTIVIDAD_LABELS[estado]}
    </StatusChip>
  );
}

/** «Vencida»: la fecha de una pendiente ya pasó y hay que cerrarla (marcarla realizada o cancelarla). */
export function ActividadVencidaChip() {
  return (
    <StatusChip value="vencida" tone="bg-status-warning-bg text-status-warning" data-vencida="" title="La fecha ya pasó: ciérrala como realizada o cancelada">
      <Icon name="warning" />
      Vencida
    </StatusChip>
  );
}

export function ActividadInstitucionChip({
  tipo,
  nivel,
}: {
  tipo: TipoInstitucionActividad;
  nivel?: keyof typeof NIVEL_EDUCATIVO_LABELS | null;
}) {
  return (
    <span className={`vc-chip ${NEUTRAL_TONE}`}>
      <Icon name={TIPO_INSTITUCION_ICON[tipo]} />
      {TIPO_INSTITUCION_LABELS[tipo]}
      {nivel ? ` · ${NIVEL_EDUCATIVO_LABELS[nivel]}` : ''}
    </span>
  );
}

export function ActividadTipoChip({ nombre }: { nombre: string }) {
  return <span className={`vc-chip ${NEUTRAL_TONE}`}>{nombre}</span>;
}
