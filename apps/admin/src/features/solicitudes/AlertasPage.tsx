import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EmptyState,
  FlipGroup,
  NotificationBell,
  NotificationStack,
  Skeleton,
  toast,
  type NotificationStackProps,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/notification-bell';
import '@yewdiel21/motion-kit/css/components/notification-stack';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ToolbarButton } from '@/shared/ui/Toolbar';
import { ToolbarFilterMenu } from '@/shared/ui/ToolbarFilterMenu';
import { ToolbarSearch } from '@/shared/ui/ToolbarSearch';
import { AlertaDetalleDrawer } from './AlertaDetalleDrawer';
import {
  ESTADO_ALERTA_LABELS,
  ORIGEN_ALERTA_LABELS,
  PRIORIDAD_ALERTA_LABELS,
  puedeAtenderAlertas,
  puedeVerColaAlertas,
  useAlertasRealtime,
  useColaAlertas,
  type AlertaCambioEvento,
  type EstadoAlerta,
  type OrigenAlerta,
  type PrioridadAlerta,
} from './api';

type NotificationStackItem = NonNullable<NotificationStackProps['items']>[number];

type EstadoFiltroId = 'activas' | EstadoAlerta | 'todas';
const ESTADO_DEFAULT: EstadoFiltroId = 'activas';

interface EstadoFiltroOption {
  id: EstadoFiltroId;
  label: string;
  estados: EstadoAlerta[] | null;
}

const ESTADO_FILTROS: readonly EstadoFiltroOption[] = [
  { id: 'activas', label: 'Activas', estados: ['nueva', 'tomada'] },
  { id: 'nueva', label: 'Nuevas', estados: ['nueva'] },
  { id: 'tomada', label: 'En atención', estados: ['tomada'] },
  { id: 'atendida', label: 'Atendidas', estados: ['atendida'] },
  { id: 'todas', label: 'Todas', estados: null },
];

const ORIGEN_FILTROS: readonly { value: OrigenAlerta; label: string; icon: string }[] = [
  { value: 'app_movil', label: ORIGEN_ALERTA_LABELS.app_movil, icon: 'sos' },
  { value: 'telefono', label: ORIGEN_ALERTA_LABELS.telefono, icon: 'call' },
  { value: 'presencial', label: ORIGEN_ALERTA_LABELS.presencial, icon: 'directions_walk' },
];

const ORIGEN_ICON: Record<OrigenAlerta, string> = {
  app_movil: 'sos',
  telefono: 'call',
  presencial: 'directions_walk',
};

const PRIORIDAD_STYLE: Record<PrioridadAlerta, { badge: string; avatar: string }> = {
  alta: {
    badge: 'bg-status-danger-bg text-status-danger',
    avatar: 'bg-status-danger-bg text-status-danger',
  },
  media: {
    badge: 'bg-status-warning-bg text-status-warning',
    avatar: 'bg-status-warning-bg text-status-warning',
  },
  baja: {
    badge: 'bg-status-info-bg text-status-info',
    avatar: 'bg-status-info-bg text-status-info',
  },
};

const ESTADO_BADGE: Record<EstadoAlerta, string> = {
  nueva: 'bg-error-container text-on-error-container',
  tomada: 'bg-secondary-container text-on-secondary-container',
  atendida: 'bg-status-success-bg text-status-success',
};

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

const STACK_LABELS = {
  expand: 'Ver alertas recientes',
  collapse: 'Ocultar recientes',
  dismiss: 'Descartar',
  empty: 'Sin alertas nuevas en esta sesión',
};

const RELATIVE_FMT = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });

function formatTiempoRelativo(iso: string): string {
  const diffSec = (new Date(iso).getTime() - Date.now()) / 1000;
  if (Number.isNaN(diffSec)) return iso;
  const abs = Math.abs(diffSec);
  if (abs < 60) return RELATIVE_FMT.format(Math.round(diffSec), 'second');
  if (abs < 3600) return RELATIVE_FMT.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return RELATIVE_FMT.format(Math.round(diffSec / 3600), 'hour');
  return RELATIVE_FMT.format(Math.round(diffSec / 86400), 'day');
}

/**
 * Bandeja en tiempo real de solicitudes y alertas (`RF-18`, `RF-20`, `RN-16`, `RN-17`).
 * Acceso permitido para Línea 24/7 (atención) y Trabajo Social / Psicología (consulta).
 * `recepcion` y `umeca` ven acceso restringido (`EmptyState`).
 */
export default function AlertasPage() {
  const { user } = useAuth();
  const canView = puedeVerColaAlertas(user?.role);
  const canAttend = puedeAtenderAlertas(user?.role);

  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltroId>(ESTADO_DEFAULT);
  const [origenFiltro, setOrigenFiltro] = useState<OrigenAlerta[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [stackItems, setStackItems] = useState<NotificationStackItem[]>([]);
  const [stackExpanded, setStackExpanded] = useState(false);
  const [latestBellMsg, setLatestBellMsg] = useState<string | undefined>(undefined);
  const [realtimeLive, setRealtimeLive] = useState(false);

  const seenRealtimeIdsRef = useRef<Set<string>>(new Set());
  const listRef = useRef<HTMLUListElement>(null);

  const activeEstadoOption =
    ESTADO_FILTROS.find((f) => f.id === estadoFiltro) ?? ESTADO_FILTROS[0];

  const {
    data: cola = [],
    isLoading,
    isError,
    refetch,
  } = useColaAlertas(activeEstadoOption.estados, 100, canView);

  const pushIncomingNotification = useCallback((evento: AlertaCambioEvento) => {
    const id = evento.alertaId || `realtime-${Date.now()}`;
    if (seenRealtimeIdsRef.current.has(id)) return;
    seenRealtimeIdsRef.current.add(id);

    const prioridadLabel = evento.prioridad
      ? PRIORIDAD_ALERTA_LABELS[evento.prioridad]
      : 'Media';
    const origenLabel = evento.origen ? ORIGEN_ALERTA_LABELS[evento.origen] : 'Canal 24/7';
    const code = id.slice(0, 8).toUpperCase();
    const title =
      evento.prioridad === 'alta'
        ? `Alerta ALTA #${code}`
        : `Nueva alerta #${code} (${prioridadLabel})`;
    const description = `Origen: ${origenLabel}`;

    setLatestBellMsg(`${title} · ${origenLabel}`);
    setStackItems((prev) => [
      {
        id,
        title,
        description,
        tone: evento.prioridad === 'alta' ? 'error' : 'info',
        duration: 0,
        dismissible: true,
        action: { label: 'Abrir detalle' },
      },
      ...prev.slice(0, 9),
    ]);

    if (evento.prioridad === 'alta') {
      toast(`${title} — ${origenLabel}. Requiere atención inmediata.`, {
        tone: 'error',
        duration: 8000,
      });
    }
  }, []);

  useAlertasRealtime({
    enabled: canView,
    onNuevaAlerta: pushIncomingNotification,
    onStatusChange: (status) => {
      setRealtimeLive(status === 'SUBSCRIBED');
    },
  });

  // Sincroniza notificaciones si aparece una alerta 'alta' nueva tras un refetch o reconexión.
  useEffect(() => {
    for (const item of cola) {
      if (item.estado === 'nueva' && item.prioridad === 'alta') {
        if (!seenRealtimeIdsRef.current.has(item.alertaId)) {
          seenRealtimeIdsRef.current.add(item.alertaId);
        }
      }
    }
  }, [cola]);

  const filteredCola = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cola.filter((item) => {
      if (origenFiltro.length > 0 && !origenFiltro.includes(item.origen)) return false;
      if (!q) return true;
      const haystacks = [
        item.alertaId,
        item.folio,
        item.nombreCompleto,
        item.asentamientoNombre,
        item.celular,
        ORIGEN_ALERTA_LABELS[item.origen],
      ];
      return haystacks.some((val) => val?.toLowerCase().includes(q));
    });
  }, [cola, origenFiltro, searchQuery]);

  const hasFilters = estadoFiltro !== ESTADO_DEFAULT || origenFiltro.length > 0 || searchQuery !== '';
  const clearFilters = useCallback(() => {
    setEstadoFiltro(ESTADO_DEFAULT);
    setOrigenFiltro([]);
    setSearchQuery('');
  }, []);

  const estadoOptions = useMemo(
    () => ESTADO_FILTROS.map((f) => ({ value: f.id, label: f.label })),
    [],
  );

  const selectedAlerta = useMemo(
    () => (selectedId ? cola.find((a) => a.alertaId === selectedId) ?? null : null),
    [cola, selectedId],
  );

  const openAlerta = useCallback((alertaId: string) => {
    setSelectedId(alertaId);
    setDrawerOpen(true);
  }, []);

  const handleDismissStackItem = useCallback((id: string) => {
    setStackItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleNotificationAction = useCallback(
    (id: string) => {
      setStackExpanded(false);
      setStackItems((prev) => prev.filter((item) => item.id !== id));
      openAlerta(id);
    },
    [openAlerta],
  );

  const signature = filteredCola
    .map((a) => `${a.alertaId}:${a.prioridad}:${a.estado}`)
    .join('|');

  if (!canView) {
    return (
      <>
        <PageHeader
          title="Solicitudes y alertas"
          subtitle="Bandeja de emergencias y atención de Línea 24/7."
        />
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="Acceso restringido"
            description="Tu rol no cuenta con permisos para consultar la cola de alertas de SEMUJERES."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Solicitudes y alertas"
        actions={
          <>
            <ToolbarSearch
              value={searchQuery}
              onChange={setSearchQuery}
              label="Buscar alertas"
              placeholder="Buscar por nombre, folio o colonia…"
            />
            <ToolbarFilterMenu
              label="Estado"
              icon="filter_list"
              options={estadoOptions}
              value={estadoFiltro}
              defaultValue={ESTADO_DEFAULT}
              onChange={(v) => setEstadoFiltro(v as EstadoFiltroId)}
            />
            <ToolbarFilterMenu
              multiple
              label="Canal"
              icon="alt_route"
              options={ORIGEN_FILTROS}
              value={origenFiltro}
              onChange={(v) => setOrigenFiltro(v as OrigenAlerta[])}
            />
            {hasFilters ? (
              <ToolbarButton icon="filter_alt_off" onClick={clearFilters}>
                Limpiar filtros
              </ToolbarButton>
            ) : null}
            <span
              className="relative inline-flex"
              title={realtimeLive ? 'Conexión en tiempo real activa' : 'Conectando en tiempo real…'}
            >
              <NotificationBell
                count={stackItems.length}
                message={latestBellMsg}
                label="Alertas entrantes"
                onOpen={() => setStackExpanded((prev) => !prev)}
              />
              <span aria-hidden className="pointer-events-none absolute right-0.5 bottom-0.5 flex size-2">
                {realtimeLive ? (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-success opacity-75" />
                ) : null}
                <span
                  className={`relative inline-flex size-2 rounded-full ring-2 ring-surface ${
                    realtimeLive ? 'bg-status-success' : 'bg-on-surface-variant/60'
                  }`}
                />
              </span>
              <span className="sr-only">
                {realtimeLive ? 'Conexión en tiempo real activa' : 'Conectando en tiempo real'}
              </span>
            </span>
          </>
        }
      />

      {!canAttend ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3.5 text-sm sm:text-base text-on-surface-variant">
          <Icon name="visibility" className="shrink-0 text-primary" />
          <span>
            Vista de solo lectura: únicamente Titular, Subdirección y Jurídico (Línea 24/7) pueden tomar y atender alertas.
          </span>
        </div>
      ) : null}

      {stackItems.length > 0 ? (
        <div className="mb-5">
          <NotificationStack
            items={stackItems}
            expanded={stackExpanded}
            onExpandedChange={setStackExpanded}
            direction="down"
            label="Alertas entrantes en tiempo real"
            labels={STACK_LABELS}
            onDismiss={handleDismissStackItem}
            onAction={handleNotificationAction}
          />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudo cargar la cola de alertas"
            description="Verifica tu conexión y permisos en Supabase."
            actions={RETRY_ACTION}
            onAction={() => {
              void refetch();
            }}
          />
        </div>
      ) : (
        <Skeleton loading={isLoading} shape="card" lines={5} label="Cargando cola de alertas">
          {filteredCola.length === 0 ? (
            <div className="rounded-3xl bg-surface-container-low p-10">
              <EmptyState
                illustration="inbox"
                title="Sin alertas en esta bandeja"
                description="Cuando ingrese una nueva solicitud desde la app móvil, teléfono o presencial, aparecerá aquí al instante."
              />
            </div>
          ) : (
            <FlipGroup root={listRef} signature={signature}>
              <ul ref={listRef} className="grid gap-3">
                {filteredCola.map((item) => {
                  const pStyle = PRIORIDAD_STYLE[item.prioridad];
                  return (
                    <li
                      key={item.alertaId}
                      data-flip-id={item.alertaId}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 transition-colors hover:bg-surface-container-low"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3.5">
                        <span
                          aria-hidden
                          className={`grid size-12 shrink-0 place-items-center rounded-full ${pStyle.avatar}`}
                        >
                          <Icon name={ORIGEN_ICON[item.origen]} className="text-[22px]" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold text-on-surface sm:text-lg">
                              {item.nombreCompleto ?? `Alerta #${item.alertaId.slice(0, 8).toUpperCase()}`}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-sm font-medium ${pStyle.badge}`}
                            >
                              Prioridad {PRIORIDAD_ALERTA_LABELS[item.prioridad].toLowerCase()}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-sm font-medium ${ESTADO_BADGE[item.estado]}`}
                            >
                              {ESTADO_ALERTA_LABELS[item.estado]}
                            </span>
                            {item.tieneOrdenVigente ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-status-danger-bg px-3 py-1 text-sm font-medium text-status-danger">
                                <span>Orden vigente</span>
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm sm:text-[0.95rem] text-on-surface-variant">
                            <span className="inline-flex items-center gap-1">
                              <Icon name={ORIGEN_ICON[item.origen]} className="text-base" />
                              <span>{ORIGEN_ALERTA_LABELS[item.origen]}</span>
                            </span>
                            {item.folio ? (
                              <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 font-mono text-xs sm:text-sm text-on-surface">
                                {item.folio}
                              </span>
                            ) : null}
                            <span>{item.asentamientoNombre ?? 'Ubicación reservada'}</span>
                            <span>
                              {item.atendidaPorNombre
                                ? `Atiende: ${item.atendidaPorNombre}`
                                : 'Sin asignar'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm text-on-surface-variant">
                          {formatTiempoRelativo(item.creadoEn)}
                        </span>
                        <button
                          type="button"
                          onClick={() => openAlerta(item.alertaId)}
                          className="mk-button mk-button--tonal"
                        >
                          {canAttend && item.estado !== 'atendida' ? 'Atender' : 'Ver detalle'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </FlipGroup>
          )}
        </Skeleton>
      )}

      <AlertaDetalleDrawer
        alerta={selectedAlerta}
        open={drawerOpen && Boolean(selectedAlerta)}
        canAttend={canAttend}
        onOpenChange={(nextOpen) => {
          setDrawerOpen(nextOpen);
        }}
        onAfterClose={() => {
          setSelectedId(null);
        }}
      />
    </>
  );
}
