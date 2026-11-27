import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { ESTADO_CITA_LABELS, type AgendaItem } from '@/domain/models/Cita';
import { catalogoQueryOptions } from '@/features/expedientes/api';
import { useAuth } from '@/shared/auth/useAuth';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ToolbarButton, ToolbarIconButton } from '@/shared/ui/Toolbar';
import { useAgenda } from './api';
import { CitaDialog, type CitaDialogState } from './CitaDialog';
import { CitasPorConfirmarPanel, ListaUrgenciasPanel } from './AgendaSidePanels';
import { AgendaMonthView } from './AgendaMonthView';
import { AgendaViewToggle, type AgendaView } from './AgendaViewToggle';
import { AgendaWeekView } from './AgendaWeekView';
import { puedeCrearCita } from './agendaPermisos';
import { areaScopeFor } from './agendaScope';
import { UMECA_BADGE_LABEL } from './citaDialogUtils';
import {
  addDays,
  addMonths,
  dayKey,
  esCitaVisible,
  formatMonthTitle,
  formatWeekTitle,
  groupCitasByDay,
  isSameDay,
  monthGridDays,
  monthGridRanges,
  startOfDay,
  startOfWeek,
  weekDays,
  weekRange,
} from './agendaDates';
import './agenda.css';

type SlideDirection = 'none' | 'next' | 'prev' | 'swap';

interface Navigation {
  view: AgendaView;
  /** Cualquier día del periodo mostrado. */
  anchor: Date;
  /** Dirección de la última navegación: decide hacia dónde se desliza el periodo nuevo. */
  direction: SlideDirection;
}

const LEGEND = [
  { tone: 'pending', label: ESTADO_CITA_LABELS.agendada },
  { tone: 'confirmed', label: ESTADO_CITA_LABELS.confirmada },
  { tone: 'urgent', label: 'Prioridad alta' },
  { tone: 'done', label: ESTADO_CITA_LABELS.asistio },
  { tone: 'muted', label: 'Cancelada / No asistió' },
] as const;

const TODAS_LAS_AREAS = { value: '', label: 'Todas las áreas' };
const EMPTY_AREA_OPTIONS = [TODAS_LAS_AREAS];
const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

const NO_RANGE = { desde: '', hasta: '' };

function initialNavigation(): Navigation {
  return { view: 'mes', anchor: startOfDay(new Date()), direction: 'none' };
}

export default function AgendaPage() {
  const { user } = useAuth();
  const [nav, setNav] = useState(initialNavigation);
  const [areaFilter, setAreaFilter] = useState('');
  // Un único diálogo para toda la página; `anchor` es el recuadro desde el que hace morph.
  const [dialogState, setDialogState] = useState<CitaDialogState | null>(null);
  const [dialogAnchor, setDialogAnchor] = useState<HTMLElement | null>(null);
  const [today] = useState(() => startOfDay(new Date()));

  const { view, anchor, direction } = nav;

  // ── Alcance por rol ────────────────────────────────────────────────────────────────
  const scope = useMemo(() => areaScopeFor(user?.role, user?.areaId), [user?.role, user?.areaId]);
  // Solo Recepción y Jurídico agendan: el resto ve la agenda sin ninguna interfaz de alta.
  const puedeCrear = puedeCrearCita(user?.role);
  const canPickArea = scope.kind !== 'own';
  const areasQuery = useQuery({ ...catalogoQueryOptions('area'), enabled: canPickArea });

  const areaOptions = useMemo(() => {
    if (scope.kind === 'own' || !areasQuery.data) return EMPTY_AREA_OPTIONS;
    const claves = scope.kind === 'claves' ? scope.claves : null;
    return [
      TODAS_LAS_AREAS,
      ...areasQuery.data
        .filter((area) => !claves || claves.includes(area.clave))
        .map((area) => ({ value: String(area.id), label: area.nombre })),
    ];
  }, [scope, areasQuery.data]);

  const areaId: number | null = scope.kind === 'own' ? scope.areaId : areaFilter ? Number(areaFilter) : null;

  // ── Periodo visible ────────────────────────────────────────────────────────────────
  const gridDays = useMemo(() => monthGridDays(anchor), [anchor]);
  const visibleWeekDays = useMemo(() => weekDays(anchor), [anchor]);
  const [rangeA, rangeB] = useMemo(
    () => (view === 'mes' ? monthGridRanges(anchor) : [weekRange(anchor), NO_RANGE]),
    [view, anchor],
  );

  // get_agenda admite máximo 31 días: la cuadrícula de 42 días se pide en dos tramos de 21.
  const queryA = useAgenda({ ...rangeA, areaId });
  const queryB = useAgenda({ ...rangeB, areaId }, view === 'mes');
  const loading = queryA.isPending || (view === 'mes' && queryB.isPending);
  const isError = queryA.isError || (view === 'mes' && queryB.isError);

  const citas = useMemo(
    () => [...(queryA.data ?? []), ...(view === 'mes' ? (queryB.data ?? []) : [])].filter(esCitaVisible),
    [queryA.data, queryB.data, view],
  );
  const byDay = useMemo(() => groupCitasByDay(citas), [citas]);
  const citasById = useMemo(() => new Map(citas.map((cita) => [cita.citaId, cita])), [citas]);

  // Tras confirmar/cancelar desde el diálogo, la agenda se refresca: el diálogo lee la versión más nueva.
  const liveDialogState = useMemo<CitaDialogState | null>(() => {
    if (!dialogState) return null;
    if (dialogState.kind === 'dia') {
      return { ...dialogState, citas: byDay.get(dayKey(dialogState.fecha)) ?? dialogState.citas };
    }
    if (dialogState.kind === 'detalle') {
      return { ...dialogState, cita: citasById.get(dialogState.cita.citaId) ?? dialogState.cita };
    }
    return dialogState;
  }, [dialogState, byDay, citasById]);

  // ── Navegación ─────────────────────────────────────────────────────────────────────
  const step = useCallback((delta: 1 | -1) => {
    setNav((prev) => ({
      ...prev,
      anchor: prev.view === 'mes' ? addMonths(prev.anchor, delta) : addDays(prev.anchor, 7 * delta),
      direction: delta === 1 ? 'next' : 'prev',
    }));
  }, []);

  const goToday = useCallback(() => {
    setNav((prev) => {
      const target = startOfDay(new Date());
      const samePeriod =
        prev.view === 'mes'
          ? target.getFullYear() === prev.anchor.getFullYear() && target.getMonth() === prev.anchor.getMonth()
          : isSameDay(startOfWeek(target), startOfWeek(prev.anchor));
      if (samePeriod) return prev;
      return { ...prev, anchor: target, direction: target > prev.anchor ? 'next' : 'prev' };
    });
  }, []);

  const changeView = useCallback((next: AgendaView) => {
    setNav((prev) => {
      if (prev.view === next) return prev;
      const todayDate = startOfDay(new Date());
      // Al pasar a semana desde el mes en curso se muestra la semana de hoy, no la del día 1.
      const sameMonth =
        todayDate.getFullYear() === prev.anchor.getFullYear() && todayDate.getMonth() === prev.anchor.getMonth();
      return {
        view: next,
        anchor: next === 'semana' && sameMonth ? todayDate : prev.anchor,
        direction: 'swap',
      };
    });
  }, []);

  // ── Diálogo ────────────────────────────────────────────────────────────────────────
  const openDay = useCallback(
    (day: Date, dayCitas: AgendaItem[], el: HTMLElement) => {
      setDialogAnchor(el);
      // Un día vacío abre el formulario de alta solo a quien puede agendar; los demás ven la vista «día» vacía.
      setDialogState(
        dayCitas.length > 0 || !puedeCrear
          ? { kind: 'dia', fecha: day, citas: dayCitas }
          : { kind: 'crear', fecha: day },
      );
    },
    [puedeCrear],
  );

  const openCita = useCallback((cita: AgendaItem, el: HTMLElement | null) => {
    setDialogAnchor(el);
    setDialogState({ kind: 'detalle', cita });
  }, []);

  const openSlot = useCallback(
    (fecha: Date, el: HTMLElement) => {
      if (!puedeCrear) return;
      setDialogAnchor(el);
      setDialogState({ kind: 'crear', fecha, areaId });
    },
    [areaId, puedeCrear],
  );

  const closeDialog = useCallback(() => setDialogState(null), []);
  const retry = useCallback(() => {
    void queryA.refetch();
    if (view === 'mes') void queryB.refetch();
  }, [queryA, queryB, view]);

  const title = view === 'mes' ? formatMonthTitle(anchor) : formatWeekTitle(visibleWeekDays);
  const stageKey =
    view === 'mes' ? `m-${anchor.getFullYear()}-${anchor.getMonth()}` : `w-${dayKey(startOfWeek(anchor))}`;
  const previousLabel = view === 'mes' ? 'Mes anterior' : 'Semana anterior';
  const nextLabel = view === 'mes' ? 'Mes siguiente' : 'Semana siguiente';
  const emptyPeriod = !loading && !isError && citas.length === 0;
  const areaNombre = scope.kind === 'own' ? (user?.areaNombre ?? null) : null;

  return (
    <>
      <PageHeader
        title={title}
        documentTitle="Agenda"
        actions={
          <div className="ag-toolbar">
            {canPickArea ? (
              <div className="ag-area-filter">
                <Select
                  size="sm"
                  label="Filtrar por área"
                  options={areaOptions}
                  value={areaFilter}
                  onChange={setAreaFilter}
                />
              </div>
            ) : areaNombre ? (
              <span className="ag-area-pill">{areaNombre}</span>
            ) : null}
            <AgendaViewToggle value={view} onChange={changeView} />
            <div className="ag-toolbar__nav">
              <ToolbarIconButton icon="chevron_left" label={previousLabel} onClick={() => step(-1)} />
              <ToolbarIconButton icon="chevron_right" label={nextLabel} onClick={() => step(1)} />
              <ToolbarButton onClick={goToday}>Hoy</ToolbarButton>
            </div>
          </div>
        }
      />

      <div className="ag-layout">
        <section className="ag-main" aria-label="Calendario de citas">
          {isError ? (
            <div className="ag-card ag-card--center">
              <EmptyState
                illustration="error"
                title="No se pudo cargar la agenda"
                description="Verifica tu conexión e inténtalo de nuevo."
                actions={RETRY_ACTION}
                onAction={retry}
              />
            </div>
          ) : (
            <div className="ag-card">
              <div key={stageKey} className="ag-stage" data-direction={direction}>
                {view === 'mes' ? (
                  <AgendaMonthView
                    days={gridDays}
                    month={anchor.getMonth()}
                    today={today}
                    byDay={byDay}
                    citasById={citasById}
                    loading={loading}
                    onOpenDay={openDay}
                    onOpenCita={openCita}
                  />
                ) : (
                  <AgendaWeekView
                    days={visibleWeekDays}
                    today={today}
                    byDay={byDay}
                    citasById={citasById}
                    loading={loading}
                    onOpenDay={openDay}
                    onOpenCita={openCita}
                    puedeCrear={puedeCrear}
                    onOpenSlot={openSlot}
                  />
                )}
              </div>
              {emptyPeriod ? (
                <p className="ag-empty" role="status">
                  {puedeCrear
                    ? `No hay citas en este periodo. Selecciona un día${view === 'semana' ? ' o una hora' : ''} para agendar.`
                    : 'No hay citas en este periodo.'}
                </p>
              ) : null}
              <ul className="ag-legend" aria-label="Colores de las citas">
                {LEGEND.map((item) => (
                  <li key={item.tone}>
                    <span className={`ag-legend__dot ag-chip--${item.tone}`} aria-hidden />
                    {item.label}
                  </li>
                ))}
                <li>
                  <span aria-hidden className="ag-chip__umeca ag-legend__umeca">
                    UMECA
                  </span>
                  {UMECA_BADGE_LABEL}
                </li>
              </ul>
            </div>
          )}
        </section>

        <aside className="ag-side" aria-label="Pendientes de la agenda">
          <CitasPorConfirmarPanel areaId={areaId} onOpenCita={openCita} />
          <ListaUrgenciasPanel areaId={areaId} />
        </aside>
      </div>

      <CitaDialog state={liveDialogState} onClose={closeDialog} anchor={dialogAnchor} />
    </>
  );
}
