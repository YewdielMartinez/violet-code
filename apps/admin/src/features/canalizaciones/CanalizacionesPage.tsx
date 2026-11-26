import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DataTable, EmptyState, Skeleton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ToolbarPrimaryButton } from '@/shared/ui/Toolbar';
import {
  DESTINO_LABELS,
  ESTADO_DERIVACION_LABELS,
  extraerMensajeErrorDerivacion,
  useDerivaciones,
  useUpdateEstadoDerivacion,
  validarTransicionDerivacion,
  type EstadoDerivacion,
} from './api';
import { CanalizacionDrawer } from './CanalizacionDrawer';
import { CanalizacionEstadoMenu } from './CanalizacionEstadoMenu';
import { CanalizacionFormDialog } from './CanalizacionFormDialog';
import {
  CANALIZACIONES_COLUMNS,
  CANALIZACIONES_ROW_ACTIONS,
  QUICK_FILTERS,
  RETRY_ACTION,
  decorateCanalizacionRows,
  type DerivacionRow,
  type EstadoFilter,
} from './canalizacionesTableConfig';

/**
 * Módulo de Canalizaciones (`RF-08`, `RN-03`, `RN-11`).
 * Tabla a ancho completo (`reflow`), detalle en panel lateral al pulsar una fila y alta en un
 * diálogo centrado; el filtro de estado vive en la barra de la pantalla.
 */
export default function CanalizacionesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLElement | null>(null);

  const rawEstado = searchParams.get('estado');
  const estadoFilter: EstadoFilter = QUICK_FILTERS.some((f) => f.id === rawEstado)
    ? (rawEstado as EstadoFilter)
    : 'todos';

  const { data, isLoading, isError, refetch } = useDerivaciones();
  const updateEstado = useUpdateEstadoDerivacion();

  const setEstadoFilter = useCallback(
    (next: EstadoFilter) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === 'todos') params.delete('estado');
          else params.set('estado', next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const counts = useMemo<Record<EstadoFilter, number>>(() => {
    const list = data ?? [];
    const count = (e: EstadoDerivacion) => list.filter((d) => d.estado === e).length;
    return {
      todos: list.length,
      pendiente: count('pendiente'),
      en_proceso: count('en_proceso'),
      concluida: count('concluida'),
      cancelada: count('cancelada'),
    };
  }, [data]);

  const byId = useMemo(() => new Map((data ?? []).map((item) => [item.id, item])), [data]);
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  const rows: DerivacionRow[] = useMemo(() => {
    const list = estadoFilter === 'todos' ? (data ?? []) : (data ?? []).filter((d) => d.estado === estadoFilter);
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

  const handleUpdateEstado = useCallback(
    async (id: string, next: EstadoDerivacion) => {
      const current = byId.get(id);
      const errMsg = current ? validarTransicionDerivacion(current.estado, next) : null;
      if (errMsg) {
        toast(errMsg, { tone: 'error' });
        return;
      }
      setUpdatingId(id);
      try {
        await updateEstado.mutateAsync({ id, estado: next });
        toast(`Canalización actualizada a ${ESTADO_DERIVACION_LABELS[next]}.`, { tone: 'success' });
      } catch (err) {
        toast(extraerMensajeErrorDerivacion(err, 'No se pudo actualizar el estado de la canalización.'), {
          tone: 'error',
        });
        throw err;
      } finally {
        setUpdatingId(null);
      }
    },
    [byId, updateEstado],
  );

  const openDetail = useCallback((id: string, origin: HTMLElement | null) => {
    originRef.current = origin;
    setSelectedId(id);
  }, []);

  const rowElement = useCallback(
    (id: string) => tableRef.current?.querySelector<HTMLElement>(`tbody tr[data-id="${CSS.escape(id)}"]`) ?? null,
    [],
  );

  const handleRowAction = useCallback(
    (action: string, row: DerivacionRow) => {
      if (action === 'ver') {
        openDetail(row.id, rowElement(row.id));
        return;
      }
      if (action !== 'en_proceso' && action !== 'concluida' && action !== 'cancelada') return;
      void handleUpdateEstado(row.id, action).catch(() => {});
    },
    [handleUpdateEstado, openDetail, rowElement],
  );

  const handleTableClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('button, a, input, label, [data-mk-dt-actions], [data-mk-dt-row-menu]')) return;
      if (window.getSelection()?.toString()) return;
      const rowEl = target.closest<HTMLTableRowElement>('tbody tr[data-id]');
      if (!rowEl || rowEl.hasAttribute('data-mk-dt-loading') || !rowEl.dataset.id) return;
      openDetail(rowEl.dataset.id, rowEl);
    },
    [openDetail],
  );

  const handleTableKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target;
      if (
        !(target instanceof HTMLTableRowElement) ||
        !target.matches('tbody tr[data-id]') ||
        target.hasAttribute('data-mk-dt-loading') ||
        !target.dataset.id
      ) {
        return;
      }
      event.preventDefault();
      openDetail(target.dataset.id, target);
    },
    [openDetail],
  );

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    originRef.current = null;
  }, []);

  const openExpediente = useCallback(
    (fichaId: string) => navigate(`/expedientes?expediente=${encodeURIComponent(fichaId)}`),
    [navigate],
  );

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Canalizaciones"
        subtitle="Derivaciones internas entre áreas y canalizaciones a instituciones externas."
        actions={
          <>
            <CanalizacionEstadoMenu value={estadoFilter} counts={counts} onChange={setEstadoFilter} />
            <ToolbarPrimaryButton
              ref={createTriggerRef}
              label="Nueva canalización"
              icon="alt_route"
              showLabel
              aria-haspopup="dialog"
              onClick={() => setCreating(true)}
            />
          </>
        }
      />

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudieron cargar las canalizaciones"
            description="Verifica tu conexión y permisos en Supabase."
            actions={RETRY_ACTION}
            onAction={() => void refetch()}
          />
        </div>
      ) : (
        <div ref={tableRef} className="vc-canalizaciones-table min-w-0">
          <Skeleton loading={isLoading} shape="card" lines={6} label="Cargando canalizaciones">
            <DataTable<DerivacionRow>
              caption="Historial de canalizaciones"
              rows={rows}
              columns={CANALIZACIONES_COLUMNS}
              actions={CANALIZACIONES_ROW_ACTIONS}
              onAction={handleRowAction}
              onClick={handleTableClick}
              onKeyDown={handleTableKeyDown}
              onRender={decorateCanalizacionRows}
              reflow="auto"
              reflowAt={640}
              pageSize={10}
              search="Buscar por folio, usuaria o destino…"
              emptyTitle="Sin canalizaciones registradas"
              emptyDescription="Usa «Nueva canalización» para derivar un expediente a otra área o institución."
            />
          </Skeleton>
        </div>
      )}

      <CanalizacionDrawer
        derivacion={selected}
        anchor={originRef}
        updatingId={updatingId}
        onUpdateEstado={handleUpdateEstado}
        onOpenExpediente={openExpediente}
        onClose={closeDetail}
      />

      <CanalizacionFormDialog open={creating} onOpenChange={setCreating} anchor={createTriggerRef} />
    </div>
  );
}
