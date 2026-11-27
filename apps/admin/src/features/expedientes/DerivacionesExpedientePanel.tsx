import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, Skeleton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { Icon } from '@/shared/ui/Icon';
import type { EstadoFicha } from '@/domain/models/Persona';
import {
  ESTADO_DERIVACION_LABELS,
  extraerMensajeErrorDerivacion,
  useDerivacionesByFicha,
  useUpdateEstadoDerivacion,
  type EstadoDerivacion,
} from '../canalizaciones/api';
import { CanalizacionFormDialog } from '../canalizaciones/CanalizacionFormDialog';
import { DerivacionTimelineList } from './canalizaciones/DerivacionTimelineList';

interface Props {
  fichaId: string;
  folio: string;
  estado?: EstadoFicha;
}

const EMPTY_CREATE_ACTIONS = [{ id: 'create', label: 'Nueva canalización' }];
const RETRY_ACTIONS = [{ id: 'retry', label: 'Reintentar' }];

/**
 * Pestaña de canalizaciones dentro del Drawer de un expediente (`RF-08`).
 * Alta en un diálogo simple (prefijado con este expediente) y línea de tiempo con transiciones de estado.
 */
export function DerivacionesExpedientePanel({ fichaId, folio, estado }: Props) {
  const isArchivado = estado === 'archivado';
  const { data: derivaciones = [], isLoading, isError, refetch } = useDerivacionesByFicha(fichaId);
  const updateEstado = useUpdateEstadoDerivacion();

  const [creating, setCreating] = useState(false);
  const [dialogMounted, setDialogMounted] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const creatingRef = useRef(false);

  useEffect(() => {
    creatingRef.current = creating;
  }, [creating]);

  const openCreate = useCallback(() => {
    creatingRef.current = true;
    setDialogMounted(true);
    setCreating(true);
  }, []);

  const handleDialogOpenChange = useCallback((next: boolean) => {
    creatingRef.current = next;
    setCreating(next);
  }, []);

  const handleDialogAfterClose = useCallback(() => {
    if (!creatingRef.current) setDialogMounted(false);
  }, []);

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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-outline-variant bg-surface-container-low p-3.5">
        <div className="grid gap-0.5">
          <p className="text-sm font-semibold text-on-surface">
            {isLoading
              ? 'Canalizaciones del expediente'
              : `${summaryCounts.total} ${summaryCounts.total === 1 ? 'canalización' : 'canalizaciones'}`}
          </p>
          <p className="text-xs text-on-surface-variant">
            {summaryCounts.activas} activas · {summaryCounts.concluidas} concluidas
          </p>
        </div>

        {!isArchivado ? (
          <button
            ref={toggleBtnRef}
            type="button"
            aria-haspopup="dialog"
            className="mk-button mk-button--sm mk-button--primary"
            onClick={openCreate}
          >
            <Icon name="alt_route" />
            <span>Canalizar</span>
          </button>
        ) : null}
      </div>

      {isArchivado ? (
        <p className="rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2 text-xs font-medium text-on-surface-variant">
          Expediente archivado: solo consulta
        </p>
      ) : null}

      {!isArchivado && (creating || dialogMounted) ? (
        <CanalizacionFormDialog
          open={creating}
          onOpenChange={handleDialogOpenChange}
          onAfterClose={handleDialogAfterClose}
          fixedFichaId={fichaId}
          fixedFolio={folio}
          anchor={toggleBtnRef}
        />
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
                description={
                  isArchivado
                    ? 'No hay canalizaciones registradas en este expediente.'
                    : 'Registra una derivación interna o externa cuando el caso lo requiera.'
                }
                actions={isArchivado ? undefined : EMPTY_CREATE_ACTIONS}
                onAction={isArchivado ? undefined : openCreate}
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
