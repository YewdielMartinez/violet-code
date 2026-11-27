import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, EmptyState, Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { puedeRegistrarActividad } from '@/domain/models/ActividadPreventiva';
import { useAuth } from '@/shared/auth/useAuth';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useActividadesPreventivas } from './api';
import { ActividadDialog, type ActividadDialogState } from './ActividadDialog';
import { ActividadesToolbar } from './ActividadesToolbar';
import {
  COLUMNS,
  RETRY_ACTION,
  ROW_ACTIONS,
  decorateActividadRows,
  toActividadRow,
  type ActividadRow,
} from './actividadesTableConfig';
import {
  ACTIVIDADES_LIMITE,
  FILTROS_INICIALES,
  construirFiltrosServidor,
  filtrarActividades,
  hayFiltrosActivos,
  ordenarActividades,
  type ActividadListFilters,
  type ActividadTab,
} from './actividadesList';
import './actividades.css';

const EMPTY_COPY: Record<ActividadTab, { title: string; description: string }> = {
  pendientes: {
    title: 'No hay actividades pendientes',
    description: 'Programa la próxima capacitación, taller o visita para que el equipo sepa a dónde ir.',
  },
  realizadas: {
    title: 'Aún no hay actividades realizadas',
    description: 'Cuando cierres una actividad pendiente como realizada, aparecerá aquí.',
  },
  canceladas: {
    title: 'No hay actividades canceladas',
    description: 'Las actividades que se cancelen quedan aquí; puedes reabrirlas si se reprograman.',
  },
  todas: {
    title: 'Todavía no hay actividades registradas',
    description: 'Registra la primera actividad preventiva para empezar el historial.',
  },
};

/** Reloj de la pantalla redondeado al minuto: estable entre renders (decide «Vencida»). */
function ahoraAlMinuto(): Date {
  return new Date(Math.floor(Date.now() / 60_000) * 60_000);
}

interface TableSectionProps {
  isLoading: boolean;
  rows: ActividadRow[];
  emptyTitle: string;
  emptyDescription: string;
  onRowAction: (action: string, row: ActividadRow) => void;
  onTableClick: (event: MouseEvent<HTMLDivElement>) => void;
  onTableKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/** Aísla la tabla para que abrir el detalle o cambiar el reloj no re-renderice DataTable innecesariamente. */
const ActividadesTableSection = memo(function ActividadesTableSection({
  isLoading,
  rows,
  emptyTitle,
  emptyDescription,
  onRowAction,
  onTableClick,
  onTableKeyDown,
}: TableSectionProps) {
  return (
    <Skeleton loading={isLoading} shape="card" lines={6} label="Cargando actividades">
      <DataTable<ActividadRow>
        className="vc-expediente-table vc-actividades-table"
        caption="Listado de actividades preventivas"
        rows={rows}
        columns={COLUMNS}
        actions={ROW_ACTIONS}
        onAction={onRowAction}
        onClick={onTableClick}
        onKeyDown={onTableKeyDown}
        onRender={decorateActividadRows}
        pageSize={10}
        search="Buscar por título, sede o lugar…"
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
    </Skeleton>
  );
});

/**
 * Actividades preventivas (`RF-16`): capacitaciones, talleres y jornadas en escuelas, empresas e instituciones.
 * Mismo esquema que Expedientes y Usuarios: tabla operativa (`DataTable`) con filtros en la barra de la pantalla;
 * el estado (pendiente / realizada / cancelada) se filtra en el servidor y una pendiente cuya fecha ya pasó se marca
 * «Vencida» (hay que cerrarla). Al hacer clic en una fila se abre el detalle con sus acciones de estado.
 * `actividad.ver` es de todo el personal; solo dirección y áreas de atención ven «Nueva actividad» (`actividad.registrar`).
 */
export default function ActividadesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const puedeRegistrar = puedeRegistrarActividad(user?.role);
  const tableRef = useRef<HTMLDivElement>(null);

  const [filtros, setFiltros] = useState<ActividadListFilters>(FILTROS_INICIALES);
  const [ahora, setAhora] = useState(ahoraAlMinuto);
  const [dialogState, setDialogState] = useState<ActividadDialogState | null>(null);
  const [dialogAnchor, setDialogAnchor] = useState<HTMLElement | null>(null);

  const cambiarFiltros = useCallback((patch: Partial<ActividadListFilters>) => {
    setFiltros((prev) => ({ ...prev, ...patch }));
    // Al cambiar de estado o de rango se toma un nuevo «ahora» para decidir las vencidas.
    if ('tab' in patch || 'desde' in patch || 'hasta' in patch) setAhora(ahoraAlMinuto());
  }, []);

  const filtrosServidor = useMemo(() => construirFiltrosServidor(filtros), [filtros]);
  const sinRango = filtrosServidor === null;
  const query = useActividadesPreventivas(filtrosServidor ?? undefined, !sinRango);
  const loading = !sinRango && query.isPending;
  const isError = !sinRango && query.isError;

  const visibles = useMemo(
    () => (sinRango ? [] : ordenarActividades(filtrarActividades(query.data ?? [], filtros))),
    [sinRango, query.data, filtros],
  );
  const porId = useMemo(() => new Map(visibles.map((a) => [a.id, a])), [visibles]);
  const todosPorId = useMemo(() => new Map((query.data ?? []).map((a) => [a.id, a])), [query.data]);
  const rows = useMemo(() => visibles.map((a) => toActividadRow(a, ahora)), [visibles, ahora]);

  // Tras un cambio de estado la lista se refresca: el diálogo lee la versión más nueva si sigue en la consulta.
  const liveDialogState = useMemo<ActividadDialogState | null>(() => {
    if (dialogState?.kind !== 'detalle') return dialogState;
    return { ...dialogState, actividad: todosPorId.get(dialogState.actividad.id) ?? dialogState.actividad };
  }, [dialogState, todosPorId]);

  const hayFiltros = hayFiltrosActivos(filtros);
  const truncado = (query.data?.length ?? 0) >= ACTIVIDADES_LIMITE;

  const openCrear = useCallback(() => navigate('/actividades/nuevo'), [navigate]);

  const openDetalle = useCallback(
    (id: string, anchor: HTMLElement | null) => {
      const actividad = porId.get(id);
      if (!actividad) return;
      setDialogAnchor(anchor);
      setDialogState({ kind: 'detalle', actividad });
    },
    [porId],
  );

  const handleRowAction = useCallback(
    (action: string, row: ActividadRow) => {
      if (action !== 'open') return;
      const anchor = tableRef.current?.querySelector<HTMLElement>(`tbody tr[data-id="${CSS.escape(row.id)}"]`) ?? null;
      openDetalle(row.id, anchor);
    },
    [openDetalle],
  );

  const handleTableClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('button, a, input, label, [data-mk-dt-actions], [data-mk-dt-row-menu]')) return;
      if (window.getSelection()?.toString()) return;

      const rowEl = target.closest<HTMLTableRowElement>('tbody tr[data-id]');
      if (!rowEl || rowEl.hasAttribute('data-mk-dt-loading')) return;
      if (rowEl.dataset.id) openDetalle(rowEl.dataset.id, rowEl);
    },
    [openDetalle],
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
      if (target.dataset.id) openDetalle(target.dataset.id, target);
    },
    [openDetalle],
  );

  const closeDialog = useCallback(() => setDialogState(null), []);

  const empty = EMPTY_COPY[filtros.tab];
  let emptyTitle = empty.title;
  let emptyDescription =
    puedeRegistrar && filtros.tab !== 'canceladas' ? 'Usa «Nueva actividad» arriba para registrar una.' : empty.description;
  if (sinRango) {
    emptyTitle = 'Rango de fechas no válido';
    emptyDescription = 'La fecha «desde» es posterior a «hasta». Ajusta el rango en «Fechas».';
  } else if (hayFiltros) {
    emptyTitle = 'Sin actividades con estos filtros';
    emptyDescription = 'Prueba con otro tipo de institución o un rango distinto, o usa «Limpiar filtros» arriba.';
  }

  return (
    <>
      <PageHeader
        title="Actividades"
        actions={<ActividadesToolbar filtros={filtros} onChange={cambiarFiltros} onCrear={puedeRegistrar ? openCrear : undefined} />}
      />

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudieron cargar las actividades"
            description="Verifica tu conexión e inténtalo de nuevo."
            actions={RETRY_ACTION}
            onAction={() => void query.refetch()}
          />
        </div>
      ) : (
        <div ref={tableRef}>
          {truncado ? (
            <p className="mb-3 text-sm text-on-surface-variant" role="status">
              Se muestran como máximo {ACTIVIDADES_LIMITE} actividades; acota con el rango de fechas.
            </p>
          ) : null}
          <ActividadesTableSection
            isLoading={loading}
            rows={rows}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            onRowAction={handleRowAction}
            onTableClick={handleTableClick}
            onTableKeyDown={handleTableKeyDown}
          />
        </div>
      )}

      <ActividadDialog
        state={liveDialogState}
        onClose={closeDialog}
        anchor={dialogAnchor}
        ahora={ahora}
        puedeRegistrar={puedeRegistrar}
      />
    </>
  );
}
