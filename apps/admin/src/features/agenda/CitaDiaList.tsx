import { useMemo } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import type { AgendaItem } from '@/domain/models/Cita';
import { Icon } from '@/shared/ui/Icon';
import { CitaEstadoChip, CitaPrioridadChip, CitaUmecaBadge } from './CitaEstadoChip';
import { areaNombre, ordenarPorHora, partesHora, type CitaDir } from './citaDialogUtils';

export interface CitaDiaListProps {
  citas: readonly AgendaItem[];
  dir: CitaDir;
  /** Sin permiso para agendar (solo Recepción y Jurídico pueden): oculta «Nueva cita». */
  puedeAgendar: boolean;
  onOpenCita: (cita: AgendaItem) => void;
  onNueva: () => void;
}

/** Vista «día»: lista de las citas del día (hora, persona, área, estado y prioridad) y alta de una nueva. */
export function CitaDiaList({ citas, dir, puedeAgendar, onOpenCita, onNueva }: CitaDiaListProps) {
  const ordenadas = useMemo(() => ordenarPorHora(citas), [citas]);

  return (
    <>
      <Dialog.Body className="vc-cita-view" data-dir={dir}>
        {ordenadas.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-2xl bg-surface-container-low px-6 py-12 text-center">
            <Icon name="event" className="text-4xl text-on-surface-variant" />
            <p className="text-base font-medium text-on-surface">Sin citas este día</p>
            <p className="text-sm text-on-surface-variant">
              {puedeAgendar ? 'Agenda una nueva cita con el botón de abajo.' : 'No hay citas programadas para este día.'}
            </p>
          </div>
        ) : (
          <ul aria-label="Citas del día" className="grid gap-2">
            {ordenadas.map((cita) => {
              const { hora, periodo } = partesHora(cita.programadaEn);
              return (
                <li key={cita.citaId}>
                  <button
                    type="button"
                    onClick={() => onOpenCita(cita)}
                    className="vc-cita-row flex w-full items-center gap-3.5 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3.5 text-left transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="vc-cita-time" aria-label={`${hora} ${periodo}`}>
                      <span className="vc-cita-time__hora">{hora}</span>
                      <span className="vc-cita-time__periodo">{periodo}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-on-surface">{cita.nombreCompleto}</span>
                      <span className="mt-0.5 block text-sm text-on-surface-variant">{areaNombre(cita.areaClave)}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <CitaEstadoChip estado={cita.estado} />
                        <CitaPrioridadChip prioridad={cita.prioridad} />
                        <CitaUmecaBadge cita={cita} />
                      </span>
                    </span>
                    <Icon name="chevron_right" className="shrink-0 text-on-surface-variant" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Dialog.Body>
      {puedeAgendar ? (
        <Dialog.Footer>
          <button type="button" className="mk-button mk-button--filled inline-flex items-center gap-1.5" onClick={onNueva}>
            <Icon name="add" />
            <span>Nueva cita</span>
          </button>
        </Dialog.Footer>
      ) : null}
    </>
  );
}
