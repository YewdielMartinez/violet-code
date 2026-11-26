import { useState } from 'react';
import { EmptyState, Skeleton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { Icon } from '@/shared/ui/Icon';
import {
  DESTINO_LABELS,
  ESTADO_DERIVACION_LABELS,
  useDerivacionesByFicha,
  useUpdateEstadoDerivacion,
  type EstadoDerivacion,
} from '../canalizaciones/api';
import { NuevaDerivacionDialog } from '../canalizaciones/NuevaDerivacionDialog';

interface Props {
  fichaId: string;
  folio: string;
}

const NEXT_STATUS: Partial<Record<EstadoDerivacion, { next: EstadoDerivacion; label: string }>> = {
  pendiente: { next: 'en_proceso', label: 'Pasar a en proceso' },
  en_proceso: { next: 'concluida', label: 'Marcar concluida' },
};

/** Pestaña de canalizaciones dentro del Drawer de un expediente (`RF-08`). */
export function DerivacionesExpedientePanel({ fichaId, folio }: Props) {
  const { data: derivaciones = [], isLoading, isError, refetch } = useDerivacionesByFicha(fichaId);
  const updateEstado = useUpdateEstadoDerivacion();
  const [openCreate, setOpenCreate] = useState(false);

  async function handleAdvance(id: string, next: EstadoDerivacion) {
    try {
      await updateEstado.mutateAsync({ id, estado: next });
      toast(`Estado actualizado a ${ESTADO_DERIVACION_LABELS[next]}.`);
    } catch {
      toast('No se pudo actualizar la canalización.', { tone: 'error' });
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-on-surface-variant">
          Historial de derivaciones internas y externas del expediente.
        </p>
        <button
          type="button"
          className="mk-button mk-button--filled mk-button--sm"
          onClick={() => setOpenCreate(true)}
        >
          <Icon name="alt_route" />
          <span className="ml-1.5">Canalizar</span>
        </button>
      </div>

      {isError ? (
        <EmptyState
          illustration="error"
          title="No se pudieron cargar las canalizaciones"
          actions={[{ id: 'retry', label: 'Reintentar' }]}
          onAction={() => void refetch()}
        />
      ) : (
        <Skeleton loading={isLoading} shape="card" lines={3} label="Cargando canalizaciones">
          {derivaciones.length === 0 ? (
            <EmptyState
              illustration="inbox"
              title="Sin canalizaciones en este expediente"
              description="Registra una derivación interna o externa cuando el caso lo requiera."
            />
          ) : (
            <ul className="grid gap-2.5">
              {derivaciones.map((d) => {
                const action = NEXT_STATUS[d.estado];
                const targetName =
                  d.areaDestinoNombre ?? d.institucionNombre ?? d.institucionOtra ?? '—';
                return (
                  <li
                    key={d.id}
                    className="grid gap-2 rounded-2xl border border-outline-variant bg-surface-container-low p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-on-surface">
                        {DESTINO_LABELS[d.destino]} · {targetName}
                      </span>
                      <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">
                        {ESTADO_DERIVACION_LABELS[d.estado]}
                      </span>
                    </div>
                    {d.motivo ? <p className="text-sm text-on-surface-variant">{d.motivo}</p> : null}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
                      <span>
                        Origen: {d.areaOrigenNombre ?? 'Dirección'} · {d.fechaDerivacion}
                      </span>
                      {action ? (
                        <button
                          type="button"
                          className="mk-button mk-button--tonal mk-button--sm"
                          onClick={() => void handleAdvance(d.id, action.next)}
                        >
                          {action.label}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Skeleton>
      )}

      <NuevaDerivacionDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        fixedFichaId={fichaId}
        fixedFolio={folio}
      />
    </div>
  );
}
