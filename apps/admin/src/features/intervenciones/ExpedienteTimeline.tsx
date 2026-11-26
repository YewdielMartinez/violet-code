import { memo, useMemo, useState } from 'react';
import { EmptyState, Skeleton, Timeline } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import '@yewdiel21/motion-kit/css/components/timeline';
import {
  TIPOS_LINEA_TIEMPO,
  TIPO_EVENTO_LABELS,
  contarPorTipo,
  mapLineaTiempo,
} from '@/domain/models/LineaTiempo';
import type { TipoEventoLineaTiempo } from '@/domain/models/Seguimiento';
import { useLineaTiempo } from './api';

export interface ExpedienteTimelineProps {
  fichaId: string;
}

type Filtro = 'todos' | TipoEventoLineaTiempo;

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

/**
 * Línea de tiempo del caso (`RF-25`, `RN-18`): citas, atenciones, derivaciones, órdenes y alertas
 * con el detalle que permite el rol (`get_linea_tiempo`). Nunca incluye notas privadas (`RN-09`).
 */
export const ExpedienteTimeline = memo(function ExpedienteTimeline({ fichaId }: ExpedienteTimelineProps) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const { data = [], isLoading, isError, refetch } = useLineaTiempo(fichaId);

  const conteo = useMemo(() => contarPorTipo(data), [data]);
  const eventos = useMemo(
    () => mapLineaTiempo(data, filtro === 'todos' ? null : new Set([filtro]), new Date()),
    [data, filtro],
  );

  if (isError) {
    return (
      <EmptyState
        illustration="error"
        title="No se pudo cargar la línea de tiempo"
        description="Verifica tu conexión e inténtalo de nuevo."
        actions={RETRY_ACTION}
        onAction={() => void refetch()}
      />
    );
  }

  const filtros = TIPOS_LINEA_TIEMPO.filter((t) => conteo[t] > 0);

  return (
    <div className="grid gap-4">
      <div role="group" aria-label="Filtrar eventos por tipo" className="flex flex-wrap gap-2">
        {(['todos', ...filtros] as Filtro[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filtro === f}
            onClick={() => setFiltro(f)}
            className={`mk-chip mk-chip--filter ${
              filtro === f ? 'bg-secondary-container text-on-secondary-container' : ''
            }`}
          >
            {f === 'todos' ? `Todos (${data.length})` : `${TIPO_EVENTO_LABELS[f]} (${conteo[f]})`}
          </button>
        ))}
      </div>

      <Skeleton loading={isLoading} shape="card" lines={4} label="Cargando línea de tiempo">
        {eventos.length === 0 ? (
          <EmptyState
            illustration="inbox"
            title="Sin eventos registrados"
            description="Aquí aparecerán las citas, atenciones, derivaciones y órdenes del expediente."
          />
        ) : (
          <Timeline events={eventos} group locale="es-MX" label="Línea de tiempo del expediente" />
        )}
      </Skeleton>

      <p className="text-xs text-on-surface-variant">
        Las notas privadas de cada área no forman parte de la línea de tiempo.
      </p>
    </div>
  );
});
