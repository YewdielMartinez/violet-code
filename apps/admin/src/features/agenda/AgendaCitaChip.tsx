import { memo } from 'react';
import { ESTADO_CITA_LABELS, PRIORIDAD_CITA_LABELS, type AgendaItem } from '@/domain/models/Cita';
import { citaTone, formatHora } from './agendaDates';
import { UMECA_BADGE_LABEL, esCitaUmeca } from './citaDialogUtils';

const AREA_LABELS: Record<string, string> = {
  trabajo_social: 'Trabajo Social',
  psicologia: 'Psicología',
  juridico: 'Jurídico',
};

export function areaLabel(clave: string): string {
  return AREA_LABELS[clave] ?? clave;
}

interface AgendaCitaChipProps {
  cita: AgendaItem;
  /** `month`: píldora de una línea; `week`: bloque con área bajo el nombre. */
  variant: 'month' | 'week';
}

/**
 * Cita compacta (hora + nombre) coloreada por estado/prioridad. No lleva `onClick`: la vista que la
 * contiene delega el clic leyendo `data-cita-id`, así los recuadros no se vuelven a renderizar al interactuar.
 */
export const AgendaCitaChip = memo(function AgendaCitaChip({ cita, variant }: AgendaCitaChipProps) {
  const hora = formatHora(new Date(cita.programadaEn));
  const prioridad = cita.prioridad === 'alta' ? `, prioridad ${PRIORIDAD_CITA_LABELS.alta.toLowerCase()}` : '';
  const umeca = esCitaUmeca(cita);
  const label = `${hora}, ${cita.nombreCompleto}, ${ESTADO_CITA_LABELS[cita.estado]}${prioridad}${umeca ? `, ${UMECA_BADGE_LABEL}` : ''}`;

  return (
    <button
      type="button"
      className={`ag-chip ag-chip--${citaTone(cita)} ag-chip--${variant}${umeca ? ' ag-chip--umeca' : ''}`}
      data-cita-id={cita.citaId}
      aria-label={label}
      title={`${label} · ${areaLabel(cita.areaClave)}`}
    >
      <span className="ag-chip__hora">{hora}</span>
      {umeca && variant === 'month' ? (
        <span aria-hidden className="ag-chip__umeca">
          UMECA
        </span>
      ) : null}
      <span className="ag-chip__name">{cita.nombreCompleto}</span>
      {variant === 'week' ? (
        <span className="ag-chip__area">
          {umeca ? (
            <span aria-hidden className="ag-chip__umeca">
              UMECA
            </span>
          ) : null}
          {areaLabel(cita.areaClave)}
        </span>
      ) : null}
    </button>
  );
});
