import { memo, type CSSProperties } from 'react';
import { estadoActividad, type ActividadPreventivaItem } from '@/domain/models/ActividadPreventiva';
import { Icon } from '@/shared/ui/Icon';
import { ActividadEstadoChip, ActividadInstitucionChip } from './ActividadChips';
import { diaNumero, horaActividad, mesCorto, ubicacionActividad } from './actividadesList';

export interface ActividadCardProps {
  actividad: ActividadPreventivaItem;
  /** Momento de referencia de la pantalla (decide Pendiente / Realizada). */
  ahora: Date;
  /** Posición en la lista: escalona la entrada (solo las primeras). */
  index: number;
}

/** Tarjeta de actividad: fecha, título, sede, ubicación y estado. El clic se delega a la lista (`data-actividad-id`). */
export const ActividadCard = memo(function ActividadCard({ actividad, ahora, index }: ActividadCardProps) {
  const estado = estadoActividad(actividad, ahora);
  const ubicacion = ubicacionActividad(actividad);
  const hora = horaActividad(actividad.programadaEn);

  return (
    <button
      type="button"
      className="act-card"
      data-actividad-id={actividad.id}
      data-estado={estado}
      style={{ '--act-i': Math.min(index, 10) } as CSSProperties}
      aria-label={`${actividad.titulo}, ${actividad.sede}, ${hora}`}
    >
      <span className="act-card__date" aria-hidden>
        <span className="act-card__day">{diaNumero(actividad.programadaEn)}</span>
        <span className="act-card__month">{mesCorto(actividad.programadaEn)}</span>
      </span>
      <span className="act-card__body">
        <span className="act-card__title">{actividad.titulo}</span>
        <span className="act-card__sede">
          <Icon name="location_on" className="text-[16px]" />
          <span className="truncate">{actividad.sede}</span>
        </span>
        {ubicacion ? <span className="act-card__meta">{ubicacion}</span> : null}
        <span className="act-card__chips">
          <ActividadEstadoChip estado={estado} />
          <ActividadInstitucionChip tipo={actividad.tipoInstitucion} nivel={actividad.nivelEducativo} />
          <span className="act-chip bg-surface-container-high text-on-surface-variant">{actividad.tipoActividadNombre}</span>
        </span>
      </span>
      <span className="act-card__aside">
        <span className="act-card__hora">{hora}</span>
        {actividad.numeroAsistentes !== null ? (
          <span className="act-card__asistentes" title="Asistentes">
            <Icon name="groups" className="text-[16px]" />
            {actividad.numeroAsistentes}
          </span>
        ) : null}
        <Icon name="chevron_right" className="text-on-surface-variant" />
      </span>
    </button>
  );
});
