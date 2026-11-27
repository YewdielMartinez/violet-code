import {
  NIVEL_EDUCATIVO_LABELS,
  TIPO_INSTITUCION_LABELS,
  type EstadoActividad,
  type TipoInstitucionActividad,
} from '@/domain/models/ActividadPreventiva';
import { Icon } from '@/shared/ui/Icon';

export const TIPO_INSTITUCION_ICON: Record<TipoInstitucionActividad, string> = {
  escuela: 'school',
  empresa_privada: 'business',
  sector_publico: 'account_balance',
  comunidad: 'groups',
  otro: 'location_on',
};

const ESTADO_STYLE: Record<EstadoActividad, { label: string; icon: string; className: string }> = {
  pendiente: {
    label: 'Pendiente',
    icon: 'schedule',
    className: 'bg-secondary-container text-on-secondary-container',
  },
  realizada: {
    label: 'Realizada',
    icon: 'check_circle',
    className: 'bg-tertiary-container text-on-tertiary-container',
  },
};

/** Chip de estado inferido por fecha (la tabla no guarda estado): Pendiente / Realizada. */
export function ActividadEstadoChip({ estado }: { estado: EstadoActividad }) {
  const style = ESTADO_STYLE[estado];
  return (
    <span className={`act-chip ${style.className}`} data-estado={estado}>
      <Icon name={style.icon} className="text-[14px]" />
      {style.label}
    </span>
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
    <span className="act-chip bg-surface-container-high text-on-surface-variant">
      <Icon name={TIPO_INSTITUCION_ICON[tipo]} className="text-[14px]" />
      {TIPO_INSTITUCION_LABELS[tipo]}
      {nivel ? ` · ${NIVEL_EDUCATIVO_LABELS[nivel]}` : ''}
    </span>
  );
}
