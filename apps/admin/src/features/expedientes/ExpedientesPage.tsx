import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataTable, EmptyState, Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import {
  ESTADO_FICHA_LABELS,
  canLookupPreRegistro,
  useExpedientes,
  useRegisterConsult,
  type ExpedienteResumen,
  type PreRegistroMovil,
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
import { ExpedienteDrawer } from './ExpedienteDrawer';
import { NuevaFichaDrawer } from './ficha/NuevaFichaDrawer';
import type { FichaSeedContext } from './ficha/useFichaForm';
import { VerificarCurpDialog } from './VerificarCurpDialog';

/**
 * Pantalla principal de Expedientes (`RF-03`, `RF-04`, `RF-34`, `RF-22`):
 * - La tabla operativa y filtros rápidos ocupan el plano principal desde el primer vistazo.
 * - Al hacer clic en una fila (o usar su acción), el panel lateral crece desde esa fila origen.
 */
export default function ExpedientesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useExpedientes();
  const { mutate: registerConsult } = useRegisterConsult();

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [originElement, setOriginElement] = useState<HTMLElement | null>(null);
  const [fichaSeed, setFichaSeed] = useState<FichaSeedContext | null>(null);
  const [preloadedDraft, setPreloadedDraft] = useState<PreRegistroMovil | null>(null);

  const rawFilter = searchParams.get('filtro');
  const quickFilter: QuickFilter = QUICK_FILTERS.some((f) => f.id === rawFilter)
    ? (rawFilter as QuickFilter)
    : 'todos';
  const selectedId = searchParams.get('expediente');

  const canCreateExpediente = user ? canLookupPreRegistro(user.role) : false;

  function setQuickFilter(next: QuickFilter) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'todos') params.delete('filtro');
        else params.set('filtro', next);
        return params;
      },
      { replace: true },
    );
  }

  function handleStartFicha(seed: FichaSeedContext) {
    setVerifyOpen(false);
    setFichaSeed(seed);
  }

  const byId = useMemo(() => {
    const map = new Map<string, ExpedienteResumen>();
    for (const item of data ?? []) map.set(item.id, item);
    return map;
  }, [data]);

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  const counts = useMemo<Record<QuickFilter, number>>(() => {
    const list = data ?? [];
    return {
      todos: list.length,
      abierto: list.filter((e) => e.estado === 'abierto').length,
      en_seguimiento: list.filter((e) => e.estado === 'en_seguimiento').length,
      prioritarios: list.filter((e) => e.enListaUrgencias).length,
      cerrado: list.filter((e) => e.estado === 'cerrado').length,
    };
  }, [data]);

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

  function openExpediente(expediente: ExpedienteResumen, origin: HTMLElement | null = null) {
    setOriginElement(origin);
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
  }

  function closeExpediente() {
    setOriginElement(null);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('expediente');
        params.delete('tab');
        return params;
      },
      { replace: true },
    );
  }

  function handleRowAction(action: string, row: ExpedienteRow) {
    if (action !== 'open') return;
    const match = byId.get(row.id);
    if (!match) return;

    const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(row.id) : row.id;
    const rowEl =
      tableContainerRef.current?.querySelector<HTMLTableRowElement>(
        `tbody tr[data-id="${escapedId}"]`,
      ) ?? null;

    openExpediente(match, rowEl);
  }

  function handleTableClick(event: MouseEvent<HTMLDivElement>) {
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
  }

  function handleTableKeyDown(event: KeyboardEvent<HTMLDivElement>) {
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
  }

  return (
    <>
      <PageHeader
        title="Expedientes"
        actions={
          canCreateExpediente ? (
            <button
              type="button"
              className="mk-button mk-button--primary"
              onClick={() => setVerifyOpen(true)}
            >
              <Icon name="person_add" />
              <span>Nuevo expediente</span>
            </button>
          ) : null
        }
      />

      {preloadedDraft ? (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-container/35 px-4 py-3 text-sm text-on-surface"
        >
          <div className="flex items-center gap-2">
            <Icon name="assignment_turned_in" className="text-primary" />
            <span>
              Precarga móvil confirmada para Ficha Única:{' '}
              <strong>{preloadedDraft.nombreCompleto}</strong> (
              <span className="font-mono">{preloadedDraft.curp}</span>)
            </span>
          </div>
          <button
            type="button"
            className="mk-button mk-button--text mk-button--sm"
            onClick={() => setPreloadedDraft(null)}
          >
            Limpiar
          </button>
        </div>
      ) : null}

      <div role="group" aria-label="Filtros rápidos de expedientes" className="mb-4 flex flex-wrap gap-2">
        {QUICK_FILTERS.map((f) => {
          const active = quickFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              onClick={() => setQuickFilter(f.id)}
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
            title="No se pudieron cargar los expedientes"
            description="Verifica tu conexión y permisos en Supabase."
            actions={RETRY_ACTION}
            onAction={() => refetch()}
          />
        </div>
      ) : (
        <div ref={tableContainerRef}>
          <Skeleton loading={isLoading} shape="card" lines={6} label="Cargando expedientes">
            <DataTable<ExpedienteRow>
              className="vc-expediente-table"
              caption="Listado de expedientes activos"
              rows={rows}
              columns={COLUMNS}
              actions={ROW_ACTIONS}
              onAction={handleRowAction}
              onClick={handleTableClick}
              onKeyDown={handleTableKeyDown}
              onRender={decorateExpedienteRows}
              pageSize={10}
              search="Buscar por folio, CURP o nombre…"
              emptyTitle="Sin expedientes en esta vista"
              emptyDescription={
                canCreateExpediente
                  ? 'Usa «Nuevo expediente» arriba para verificar una CURP o confirmar un pre-registro móvil.'
                  : 'No hay expedientes activos que coincidan con el filtro seleccionado.'
              }
            />
          </Skeleton>
        </div>
      )}

      {canCreateExpediente ? (
        <VerificarCurpDialog
          open={verifyOpen}
          onOpenChange={setVerifyOpen}
          allowPreRegistroLookup={canCreateExpediente}
          onOpenExpediente={(expediente) => openExpediente(expediente)}
          onPreloadConfirmed={setPreloadedDraft}
          onStartFicha={handleStartFicha}
        />
      ) : null}

      <ExpedienteDrawer
        expediente={selected}
        originElement={originElement}
        userRole={user?.role}
        canManage={canCreateExpediente}
        onClose={closeExpediente}
      />
      <NuevaFichaDrawer open={Boolean(fichaSeed)} seed={fichaSeed} onClose={() => setFichaSeed(null)} />
    </>
  );
}
