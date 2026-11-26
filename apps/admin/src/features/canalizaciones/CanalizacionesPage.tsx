import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DataTable,
  EmptyState,
  Skeleton,
  toast,
  type DataAction,
  type DataTableProps,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import {
  DESTINO_LABELS,
  ESTADO_DERIVACION_LABELS,
  ESTADOS_DERIVACION,
  useDerivaciones,
  useUpdateEstadoDerivacion,
  type EstadoDerivacion,
} from './api';
import { NuevaDerivacionDialog } from './NuevaDerivacionDialog';

type EstadoFilter = 'todos' | EstadoDerivacion;

interface DerivacionRow extends Record<string, unknown> {
  id: string;
  folio: string;
  usuariaNombre: string;
  origenLabel: string;
  destinoLabel: string;
  detalleDestino: string;
  estadoLabel: string;
  fechaDerivacion: string;
}

const ESTADO_OPTIONS = ESTADOS_DERIVACION.map((e) => ({
  value: ESTADO_DERIVACION_LABELS[e],
  label: ESTADO_DERIVACION_LABELS[e],
}));

const COLUMNS: DataTableProps<DerivacionRow>['columns'] = [
  { key: 'folio', label: 'Folio', sortable: true, searchable: true },
  { key: 'usuariaNombre', label: 'Usuaria', sortable: true, searchable: true },
  { key: 'origenLabel', label: 'Origen', sortable: true },
  { key: 'destinoLabel', label: 'Destino', sortable: true, searchable: true },
  { key: 'detalleDestino', label: 'Área / Institución', searchable: true },
  {
    key: 'estadoLabel',
    label: 'Estado',
    type: 'select',
    filterable: true,
    options: ESTADO_OPTIONS,
  },
  { key: 'fechaDerivacion', label: 'Fecha', sortable: true },
];

const ROW_ACTIONS: DataAction[] = [
  { id: 'en_proceso', label: 'Marcar en proceso' },
  { id: 'concluida', label: 'Marcar concluida' },
  { id: 'cancelada', label: 'Cancelar canalización', danger: true },
];

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

const QUICK_FILTERS: { id: EstadoFilter; label: string }[] = [
  { id: 'todos', label: 'Todas' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'en_proceso', label: 'En proceso' },
  { id: 'concluida', label: 'Concluidas' },
  { id: 'cancelada', label: 'Canceladas' },
];

/**
 * Módulo de Canalizaciones (`RF-08`, `RN-03`, `RN-11`).
 * Muestra derivaciones internas y externas filtrables por estado en URL Search Params.
 */
export default function CanalizacionesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const rawEstado = searchParams.get('estado');
  const estadoFilter: EstadoFilter = QUICK_FILTERS.some((f) => f.id === rawEstado)
    ? (rawEstado as EstadoFilter)
    : 'todos';

  const { data, isLoading, isError, refetch } = useDerivaciones();
  const updateEstado = useUpdateEstadoDerivacion();

  function setEstadoFilter(next: EstadoFilter) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'todos') params.delete('estado');
        else params.set('estado', next);
        return params;
      },
      { replace: true },
    );
  }

  const counts = useMemo<Record<EstadoFilter, number>>(() => {
    const list = data ?? [];
    return {
      todos: list.length,
      pendiente: list.filter((d) => d.estado === 'pendiente').length,
      en_proceso: list.filter((d) => d.estado === 'en_proceso').length,
      concluida: list.filter((d) => d.estado === 'concluida').length,
      cancelada: list.filter((d) => d.estado === 'cancelada').length,
    };
  }, [data]);

  const rows: DerivacionRow[] = useMemo(() => {
    const list =
      estadoFilter === 'todos' ? (data ?? []) : (data ?? []).filter((d) => d.estado === estadoFilter);

    return list.map((d) => ({
      id: d.id,
      folio: d.folio,
      usuariaNombre: d.usuariaNombre,
      origenLabel: d.areaOrigenNombre ?? 'Dirección / General',
      destinoLabel: DESTINO_LABELS[d.destino],
      detalleDestino: d.areaDestinoNombre ?? d.institucionNombre ?? d.institucionOtra ?? '—',
      estadoLabel: ESTADO_DERIVACION_LABELS[d.estado],
      fechaDerivacion: d.fechaDerivacion,
    }));
  }, [data, estadoFilter]);

  async function handleRowAction(action: string, row: DerivacionRow) {
    if (action !== 'en_proceso' && action !== 'concluida' && action !== 'cancelada') return;
    try {
      await updateEstado.mutateAsync({ id: row.id, estado: action });
      toast(`Canalización actualizada a ${ESTADO_DERIVACION_LABELS[action]}.`);
    } catch {
      toast('No se pudo actualizar el estado de la canalización.', { tone: 'error' });
    }
  }

  return (
    <>
      <PageHeader
        title="Canalizaciones"
        subtitle="Derivaciones internas entre áreas y canalizaciones a instituciones externas."
        actions={
          <button
            type="button"
            className="mk-button mk-button--filled"
            onClick={() => setDialogOpen(true)}
          >
            <Icon name="alt_route" />
            <span className="ml-2">Nueva canalización</span>
          </button>
        }
      />

      <div role="group" aria-label="Filtrar canalizaciones por estado" className="mb-4 flex flex-wrap gap-2">
        {QUICK_FILTERS.map((f) => {
          const active = estadoFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              onClick={() => setEstadoFilter(f.id)}
              className={`mk-chip mk-chip--filter ${
                active ? 'bg-secondary-container text-on-secondary-container' : ''
              }`}
            >
              <span>{f.label}</span>
              <span className="ml-1.5 font-mono text-xs opacity-75">{counts[f.id]}</span>
            </button>
          );
        })}
      </div>

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudieron cargar las canalizaciones"
            description="Verifica tu conexión y permisos en Supabase."
            actions={RETRY_ACTION}
            onAction={() => refetch()}
          />
        </div>
      ) : (
        <Skeleton loading={isLoading} shape="card" lines={6} label="Cargando canalizaciones">
          <DataTable<DerivacionRow>
            caption="Historial de canalizaciones"
            rows={rows}
            columns={COLUMNS}
            actions={ROW_ACTIONS}
            onAction={handleRowAction}
            pageSize={10}
            search="Buscar por folio, usuaria o destino…"
            emptyTitle="Sin canalizaciones registradas"
            emptyDescription="Usa «Nueva canalización» para derivar un expediente a otra área o institución."
          />
        </Skeleton>
      )}

      <NuevaDerivacionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
