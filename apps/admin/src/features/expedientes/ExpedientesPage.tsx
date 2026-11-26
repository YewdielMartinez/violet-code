import {
  memo,
  useCallback,
  useMemo,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DataTable, EmptyState, Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { preloadPage } from '@/app/pages';
import { puedeAccederAgresor } from '@/domain/models/Agresor';
import { useAuth } from '@/shared/auth/useAuth';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ToolbarPrimaryButton } from '@/shared/ui/Toolbar';
import { ToolbarFilterMenu } from '@/shared/ui/ToolbarFilterMenu';
import {
  ESTADO_FICHA_LABELS,
  canLookupPreRegistro,
  useExpedientes,
  useRegisterConsult,
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
import { ExpedienteDrawer, preloadExpedienteDrawerTabs } from './ExpedienteDrawer';

interface TableSectionProps {
  tableContainerRef: RefObject<HTMLDivElement | null>;
  onRowIntent?: () => void;
  isLoading: boolean;
  rows: ExpedienteRow[];
  emptyDescription: string;
  onRowAction: (action: string, row: ExpedienteRow) => void;
  onTableClick: (event: MouseEvent<HTMLDivElement>) => void;
  onTableKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/** Aísla la tabla operativa para que abrir/cerrar el panel o cambiar de pestaña no re-renderice DataTable. */
const ExpedientesTableSection = memo(function ExpedientesTableSection({
  tableContainerRef,
  onRowIntent,
  isLoading,
  rows,
  emptyDescription,
  onRowAction,
  onTableClick,
  onTableKeyDown,
}: TableSectionProps) {
  return (
    <div ref={tableContainerRef} onPointerOver={onRowIntent} onFocus={onRowIntent}>
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
 * - Al hacer clic en una fila (o usar su acción), el panel lateral crece desde esa fila origen.
 * - «Nuevo expediente» abre directamente el asistente de Nueva Ficha Única con verificación de CURP inline.
 */
export default function ExpedientesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useExpedientes();
  const { mutate: registerConsult } = useRegisterConsult();

  const tableContainerRef = useRef<HTMLDivElement>(null);
  // Se usa ref en vez de useState para el ancla: evita re-render extra y carreras con setSearchParams.
  const originRef = useRef<HTMLElement | null>(null);

  const rawFilter = searchParams.get('filtro');
  const quickFilter: QuickFilter = QUICK_FILTERS.some((f) => f.id === rawFilter)
    ? (rawFilter as QuickFilter)
    : 'todos';
  const selectedId = searchParams.get('expediente');

  const canCreateExpediente = user ? canLookupPreRegistro(user.role) : false;
  const canAccessSensitiveTabs = puedeAccederAgresor(user?.role);

  const handleRowIntent = useCallback(() => {
    if (canAccessSensitiveTabs) preloadExpedienteDrawerTabs();
  }, [canAccessSensitiveTabs]);

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

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

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
    (expediente: ExpedienteResumen, origin: HTMLElement | null = null) => {
      originRef.current = origin;
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('expediente', expediente.id);
          params.delete('tab');
          return params;
        },
        { replace: true },
      );
      registerConsult(expediente.id);
    },
    [registerConsult, setSearchParams],
  );

  const closeExpediente = useCallback(() => {
    originRef.current = null;
    setSearchParams(
      (prev) => {
        if (!prev.has('expediente') && !prev.has('tab')) return prev;
        const params = new URLSearchParams(prev);
        params.delete('expediente');
        params.delete('tab');
        return params;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const handleRowAction = useCallback(
    (action: string, row: ExpedienteRow) => {
      if (action !== 'open') return;
      const match = byId.get(row.id);
      if (!match) return;

      const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(row.id) : row.id;
      const rowEl =
        tableContainerRef.current?.querySelector<HTMLTableRowElement>(
          `tbody tr[data-id="${escapedId}"]`,
        ) ?? null;

      openExpediente(match, rowEl);
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
      if (match) openExpediente(match, rowEl);
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
      if (match) openExpediente(match, target);
    },
    [byId, openExpediente],
  );

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
          tableContainerRef={tableContainerRef}
          onRowIntent={handleRowIntent}
          isLoading={isLoading}
          rows={rows}
          emptyDescription={emptyDescription}
          onRowAction={handleRowAction}
          onTableClick={handleTableClick}
          onTableKeyDown={handleTableKeyDown}
        />
      )}

      <ExpedienteDrawer
        expediente={selected}
        anchor={originRef}
        userRole={user?.role}
        canManage={canCreateExpediente}
        onClose={closeExpediente}
      />
    </>
  );
}
