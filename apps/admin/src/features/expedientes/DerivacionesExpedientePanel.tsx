import { useMemo, useState } from 'react';
import { EmptyState, Skeleton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import type { EstadoFicha } from '@/domain/models/Persona';
import {
  ESTADO_DERIVACION_LABELS,
  extraerMensajeErrorDerivacion,
  useDerivacionesByFicha,
  useUpdateEstadoDerivacion,
  type EstadoDerivacion,
} from '../canalizaciones/api';
import { DerivacionTimelineList } from './canalizaciones/DerivacionTimelineList';

interface Props {
  fichaId: string;
  folio: string;
  estado?: EstadoFicha;
}

const RETRY_ACTIONS = [{ id: 'retry', label: 'Reintentar' }];

/**
 * Pestaña de canalizaciones dentro del detalle de un expediente (`RF-08`).
 * Solo consulta y seguimiento de estado: las canalizaciones nuevas se registran desde el módulo Canalizaciones.
 */
export function DerivacionesExpedientePanel({ fichaId, estado }: Props) {
  const isArchivado = estado === 'archivado';
  const { data: derivaciones = [], isLoading, isError, refetch } = useDerivacionesByFicha(fichaId);
  const updateEstado = useUpdateEstadoDerivacion();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const summaryCounts = useMemo(() => {
    let activas = 0;
    let concluidas = 0;
    for (const d of derivaciones) {
      if (d.estado === 'pendiente' || d.estado === 'en_proceso') activas++;
      else if (d.estado === 'concluida') concluidas++;
    }
    return { total: derivaciones.length, activas, concluidas };
  }, [derivaciones]);

  async function handleUpdateEstado(id: string, next: EstadoDerivacion) {
    setUpdatingId(id);
    try {
      await updateEstado.mutateAsync({ id, estado: next });
      toast(`Estado actualizado a ${ESTADO_DERIVACION_LABELS[next]}.`, { tone: 'success' });
    } catch (err) {
      const msg = extraerMensajeErrorDerivacion(err, 'No se pudo actualizar la canalización.');
      toast(msg, { tone: 'error' });
      throw err;
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section aria-label="Canalizaciones del expediente" className="grid gap-4">
      <div className="grid gap-0.5 rounded-2xl border border-outline-variant bg-surface-container-low p-3.5">
        <p className="text-sm font-semibold text-on-surface">
          {isLoading
            ? 'Canalizaciones del expediente'
            : `${summaryCounts.total} ${summaryCounts.total === 1 ? 'canalización' : 'canalizaciones'}`}
        </p>
        <p className="text-xs text-on-surface-variant">
          {summaryCounts.activas} activas · {summaryCounts.concluidas} concluidas
        </p>
      </div>

      {isArchivado ? (
        <p className="rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2 text-xs font-medium text-on-surface-variant">
          Expediente archivado: solo consulta
        </p>
      ) : null}

      {isError ? (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
          <EmptyState
            illustration="error"
            title="No se pudieron cargar las canalizaciones"
            actions={RETRY_ACTIONS}
            onAction={() => void refetch()}
          />
        </div>
      ) : (
        <Skeleton loading={isLoading} shape="card" lines={3} label="Cargando canalizaciones">
          {derivaciones.length === 0 ? (
            <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
              <EmptyState
                illustration="inbox"
                title="Sin canalizaciones en este expediente"
                description="No hay canalizaciones registradas en este expediente."
              />
            </div>
          ) : (
            <DerivacionTimelineList
              derivaciones={derivaciones}
              updatingId={updatingId}
              onUpdateEstado={handleUpdateEstado}
            />
          )}
        </Skeleton>
      )}
    </section>
  );
}
