import {
  memo,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { DataTable, EmptyState, Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { preloadPage } from '@/app/pages';
import { useAuth } from '@/shared/auth/useAuth';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ToolbarPrimaryButton } from '@/shared/ui/Toolbar';
import { ToolbarFilterMenu } from '@/shared/ui/ToolbarFilterMenu';
import {
  ESTADO_FICHA_LABELS,
  canLookupPreRegistro,
  expedienteByIdQueryOptions,
  fichaDetailQueryOptions,
  useExpedientes,
  type ExpedienteResumen,
} from './api';
import {
  COLUMNS,
  QUICK_FILTERS,
  RETRY_ACTION,
  ROW_ACTIONS,
  decorateExpedienteRows,
  formatTableDate,
  type ExpedienteRow,
  type QuickFilter,
} from './drawer/expedientesTableConfig';

interface TableSectionProps {
  isLoading: boolean;
  rows: ExpedienteRow[];
  emptyDescription: string;
  onRowAction: (action: string, row: ExpedienteRow) => void;
  onTableClick: (event: MouseEvent<HTMLDivElement>) => void;
  onTableKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/** Aísla la tabla operativa para que los filtros o acciones no re-rendericen DataTable innecesariamente. */
const ExpedientesTableSection = memo(function ExpedientesTableSection({
  isLoading,
  rows,
  emptyDescription,
  onRowAction,
  onTableClick,
  onTableKeyDown,
}: TableSectionProps) {
  return (
    <div onPointerOver={() => preloadPage('/expedientes/preview')}>
      <Skeleton loading={isLoading} shape="card" lines={6} label="Cargando expedientes">
        <DataTable<ExpedienteRow>
          className="vc-expediente-table"
          caption="Listado de expedientes activos"
          rows={rows}
          columns={COLUMNS}
          actions={ROW_ACTIONS}
          onAction={onRowAction}
          onClick={onTableClick}
          onKeyDown={onTableKeyDown}
          onRender={decorateExpedienteRows}
          pageSize={10}
          search="Buscar por folio, CURP o nombre…"
          emptyTitle="Sin expedientes en esta vista"
          emptyDescription={emptyDescription}
        />
      </Skeleton>
    </div>
  );
});

/**
 * Pantalla principal de Expedientes (`RF-03`, `RF-04`, `RF-34`, `RF-22`):
 * - La tabla operativa y filtros rápidos ocupan el plano principal desde el primer vistazo.
 * - Al hacer clic en una fila (o usar su acción), navega a la vista dedicada `/expedientes/:id`.
 * - «Nuevo expediente» abre directamente el asistente de Nueva Ficha Única con verificación de CURP inline.
 */
export default function ExpedientesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useExpedientes();

  const rawFilter = searchParams.get('filtro');
  const quickFilter: QuickFilter = QUICK_FILTERS.some((f) => f.id === rawFilter)
    ? (rawFilter as QuickFilter)
    : 'todos';
  const selectedId = searchParams.get('expediente');

  const canCreateExpediente = user ? canLookupPreRegistro(user.role) : false;

  const setQuickFilter = useCallback(
    (next: QuickFilter) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === 'todos') params.delete('filtro');
          else params.set('filtro', next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const byId = useMemo(() => {
    const map = new Map<string, ExpedienteResumen>();
    for (const item of data ?? []) map.set(item.id, item);
    return map;
  }, [data]);

  const counts = useMemo<Record<QuickFilter, number>>(() => {
    const list = data ?? [];
    const next: Record<QuickFilter, number> = {
      todos: list.length,
      abierto: 0,
      en_seguimiento: 0,
      prioritarios: 0,
      cerrado: 0,
    };
    for (const e of list) {
      if (e.estado === 'abierto') next.abierto++;
      else if (e.estado === 'en_seguimiento') next.en_seguimiento++;
      else if (e.estado === 'cerrado') next.cerrado++;
      if (e.enListaUrgencias) next.prioritarios++;
    }
    return next;
  }, [data]);

  const filterOptions = useMemo(
    () => QUICK_FILTERS.map((f) => ({ value: f.id, label: f.label, count: counts[f.id] })),
    [counts],
  );

  const filteredItems = useMemo(() => {
    const list = data ?? [];
    if (quickFilter === 'todos') return list;
    if (quickFilter === 'prioritarios') return list.filter((e) => e.enListaUrgencias);
    return list.filter((e) => e.estado === quickFilter);
  }, [data, quickFilter]);

  const rows: ExpedienteRow[] = useMemo(
    () =>
      filteredItems.map((item) => ({
        id: item.id,
        folio: item.folio,
        nombreCompleto: item.persona.nombreCompleto,
        curp: item.persona.curp,
        estado: ESTADO_FICHA_LABELS[item.estado],
        urgencia: item.enListaUrgencias ? 'Prioritario' : 'Normal',
        actualizadoLabel: formatTableDate(item.actualizadoEn),
      })),
    [filteredItems],
  );

  const openExpediente = useCallback(
    (expediente: ExpedienteResumen) => {
      const target = `/expedientes/${encodeURIComponent(expediente.id)}`;
      preloadPage(target);
      void queryClient.prefetchQuery(expedienteByIdQueryOptions(expediente.id));
      void queryClient.prefetchQuery(fichaDetailQueryOptions(expediente.id));
      navigate(target);
    },
    [navigate, queryClient],
  );

  const handleRowAction = useCallback(
    (action: string, row: ExpedienteRow) => {
      if (action !== 'open') return;
      const match = byId.get(row.id);
      if (match) openExpediente(match);
    },
    [byId, openExpediente],
  );

  const handleTableClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('button, a, input, label, [data-mk-dt-actions], [data-mk-dt-row-menu]')) {
        return;
      }
      if (window.getSelection()?.toString()) return;

      const rowEl = target.closest<HTMLTableRowElement>('tbody tr[data-id]');
      if (!rowEl || rowEl.hasAttribute('data-mk-dt-loading')) return;

      const rowId = rowEl.dataset.id;
      const match = rowId ? byId.get(rowId) : undefined;
      if (match) openExpediente(match);
    },
    [byId, openExpediente],
  );

  const handleTableKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target;
      if (
        !(target instanceof HTMLTableRowElement) ||
        !target.matches('tbody tr[data-id]') ||
        target.hasAttribute('data-mk-dt-loading')
      ) {
        return;
      }

      event.preventDefault();
      const rowId = target.dataset.id;
      const match = rowId ? byId.get(rowId) : undefined;
      if (match) openExpediente(match);
    },
    [byId, openExpediente],
  );

  if (selectedId) {
    const tab = searchParams.get('tab');
    const target = tab
      ? `/expedientes/${encodeURIComponent(selectedId)}?tab=${encodeURIComponent(tab)}`
      : `/expedientes/${encodeURIComponent(selectedId)}`;
    return <Navigate to={target} replace />;
  }

  const emptyDescription = canCreateExpediente
    ? 'Usa «Nuevo expediente» arriba para registrar una nueva Ficha Única.'
    : 'No hay expedientes activos que coincidan con el filtro seleccionado.';

  return (
    <>
      <PageHeader
        title="Expedientes"
        actions={
          <>
            <ToolbarFilterMenu
              label="Estado"
              icon="filter_list"
              options={filterOptions}
              value={quickFilter}
              defaultValue="todos"
              onChange={(v) => setQuickFilter(v as QuickFilter)}
            />
            {canCreateExpediente ? (
              <ToolbarPrimaryButton
                label="Nuevo expediente"
                icon="person_add"
                showLabel
                onPointerEnter={() => preloadPage('/expedientes/nuevo')}
                onFocus={() => preloadPage('/expedientes/nuevo')}
                onClick={() => navigate('/expedientes/nuevo')}
              />
            ) : null}
          </>
        }
      />

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudieron cargar los expedientes"
            description="Verifica tu conexión y permisos en Supabase."
            actions={RETRY_ACTION}
            onAction={() => refetch()}
          />
        </div>
      ) : (
        <ExpedientesTableSection
          isLoading={isLoading}
          rows={rows}
          emptyDescription={emptyDescription}
          onRowAction={handleRowAction}
          onTableClick={handleTableClick}
          onTableKeyDown={handleTableKeyDown}
        />
      )}
    </>
  );
}
