import {
  lazy,
  memo,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import { puedeAccederAgresor } from './agresorApi';
import {
  ESTADO_FICHA_LABELS,
  canLookupPreRegistro,
  fichaDetailQueryOptions,
  useExpedienteById,
  useRegisterConsult,
} from './api';
import './expediente-detail.css';
import { ExpedienteContactoSection } from './drawer/ExpedienteContactoSection';
import type { DrawerTab } from './drawer/ExpedienteDrawerTabs';
import {
  ESTADO_BADGE_STYLES,
  calculateAge,
  copyTextToClipboard,
  formatFechaNacimiento,
  formatPhoneDisplay,
  formatSexo,
} from './drawer/formatters';
import { preloadExpedienteDrawerTab } from './ExpedienteDrawer';
import { FichaDetalleResumen } from './ficha/FichaDetalleResumen';
import { FichaGestionAcciones } from './ficha/FichaGestionAcciones';

const AgresorFormSection = lazy(() =>
  import('./AgresorFormSection').then((m) => ({ default: m.AgresorFormSection })),
);
const DocumentosAdjuntosPanel = lazy(() =>
  import('./DocumentosAdjuntosPanel').then((m) => ({ default: m.DocumentosAdjuntosPanel })),
);
const DerivacionesExpedientePanel = lazy(() =>
  import('./DerivacionesExpedientePanel').then((m) => ({
    default: m.DerivacionesExpedientePanel,
  })),
);
const OrdenesProteccionPanel = lazy(() =>
  import('@/features/solicitudes/OrdenesProteccionPanel').then((m) => ({
    default: m.OrdenesProteccionPanel,
  })),
);
const ExpedienteTimeline = lazy(() =>
  import('@/features/intervenciones/ExpedienteTimeline').then((m) => ({
    default: m.ExpedienteTimeline,
  })),
);
const NotasPrivadasPanel = lazy(() =>
  import('@/features/intervenciones/NotasPrivadasPanel').then((m) => ({
    default: m.NotasPrivadasPanel,
  })),
);

interface TabDefinition {
  id: DrawerTab;
  label: string;
  icon: string;
  sensitive: boolean;
}

const ALL_TABS: readonly TabDefinition[] = [
  { id: 'resumen', label: 'Datos', icon: 'badge', sensitive: false },
  { id: 'agresor', label: 'Persona agresora', icon: 'shield_person', sensitive: true },
  { id: 'documentos', label: 'Documentos', icon: 'folder_open', sensitive: true },
  { id: 'canalizaciones', label: 'Canalizaciones', icon: 'alt_route', sensitive: true },
  { id: 'ordenes', label: 'Órdenes de Protección', icon: 'gavel', sensitive: true },
  { id: 'seguimiento', label: 'Seguimiento', icon: 'timeline', sensitive: true },
  { id: 'notas', label: 'Notas privadas', icon: 'lock', sensitive: true },
];

const SENSITIVE_TAB_ORDER: readonly DrawerTab[] = [
  'agresor',
  'documentos',
  'canalizaciones',
  'ordenes',
  'seguimiento',
  'notas',
];

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];
const BACK_TO_LIST_ACTION = [{ id: 'back', label: 'Volver a expedientes' }];

function parseRequestedTab(rawTab: string | null): DrawerTab {
  if (
    rawTab === 'agresor' ||
    rawTab === 'documentos' ||
    rawTab === 'canalizaciones' ||
    rawTab === 'ordenes' ||
    rawTab === 'seguimiento' ||
    rawTab === 'notas'
  ) {
    return rawTab;
  }
  return 'resumen';
}

function scheduleIdleStep(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => { };
  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(cb, { timeout: 2500 });
    return () => window.cancelIdleCallback(idleId);
  }
  const timerId = window.setTimeout(cb, 150);
  return () => window.clearTimeout(timerId);
}

const SectionSkeleton = memo(function SectionSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="grid min-h-[320px] content-start gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="h-5 w-44 rounded-full bg-surface-container-high animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-28 rounded-full bg-surface-container animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-20 rounded-xl bg-surface-container animate-pulse motion-reduce:animate-none" />
        <div className="h-20 rounded-xl bg-surface-container animate-pulse motion-reduce:animate-none" />
        <div className="h-32 rounded-xl bg-surface-container animate-pulse motion-reduce:animate-none sm:col-span-2" />
      </div>
    </div>
  );
});

const PageLoadingSkeleton = memo(function PageLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Cargando expediente"
      className="mx-auto grid w-full gap-4 px-4 sm:px-6"
    >
      <div className="flex flex-wrap items-center gap-3 pb-1">
        <div className="h-7 w-32 rounded-full bg-surface-container-high animate-pulse motion-reduce:animate-none" />
        <div className="h-7 w-28 rounded-full bg-surface-container animate-pulse motion-reduce:animate-none" />
        <div className="h-5 w-48 rounded-lg bg-surface-container animate-pulse motion-reduce:animate-none" />
        <div className="h-5 w-40 rounded-lg bg-surface-container animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="flex items-center gap-2 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low p-1.5">
        {Array.from({ length: 5 }, (_, idx) => (
          <div
            key={idx}
            className="h-11 w-32 shrink-0 rounded-full bg-surface-container animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
      <SectionSkeleton label="Cargando detalle del expediente" />
    </div>
  );
});

interface LazyTabPanelProps {
  id: string;
  labelledBy: string;
  active: boolean;
  motionClass: string;
  label: string;
  children: ReactNode;
}

const LazyTabPanel = memo(function LazyTabPanel({
  id,
  labelledBy,
  active,
  motionClass,
  label,
  children,
}: LazyTabPanelProps) {
  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      hidden={!active}
      className={active ? `min-w-0 ${motionClass}`.trim() : 'hidden'}
    >
      <Suspense fallback={<SectionSkeleton label={label} />}>{children}</Suspense>
    </div>
  );
});

interface SummaryStripProps {
  expediente: ExpedienteResumen;
}

const SummaryStrip = memo(function SummaryStrip({ expediente }: SummaryStripProps) {
  const statusStyle = ESTADO_BADGE_STYLES[expediente.estado];
  const age = calculateAge(expediente.persona.fechaNacimiento);
  const formattedPhone = formatPhoneDisplay(expediente.persona.celular);

  return (
    <section
      aria-label="Resumen de la usuaria"
      className="mx-auto flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 sm:px-6"
    >
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-sm font-medium ${statusStyle.pill}`}
      >
        <span aria-hidden className={`size-2 rounded-full ${statusStyle.dot}`} />
        <span>{ESTADO_FICHA_LABELS[expediente.estado]}</span>
      </span>

      {expediente.enListaUrgencias ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-status-danger-bg px-3.5 py-1 text-sm font-medium text-status-danger">
          <span aria-hidden className="size-2 rounded-full bg-status-danger" />
          <span>Prioritario</span>
        </span>
      ) : null}

      <span className="rounded-full bg-surface-container-high px-3 py-1 font-mono text-sm font-semibold text-on-surface">
        {expediente.folio}
      </span>

      <span className="text-sm text-on-surface-variant">
        {formatSexo(expediente.persona.sexo)} ·{' '}
        {age !== null ? `${age} años` : 'Edad sin registrar'} · Nac.{' '}
        {formatFechaNacimiento(expediente.persona.fechaNacimiento)}
      </span>

      <span className="font-mono text-sm font-semibold text-on-surface">
        {expediente.persona.curp}
      </span>

      {formattedPhone ? (
        <span className="font-mono text-sm font-medium text-on-surface-variant">
          {formattedPhone}
        </span>
      ) : null}
    </section>
  );
});

/**
 * Página dedicada de detalle de expediente (`/expedientes/:id`).
 * Reemplaza la vista estrecha del cajón con navegación superior por pestañas,
 * carga diferida por chunk y registro único de consulta en bitácora (`RF-22`).
 */
export default function ExpedienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: expediente, isLoading, isError, refetch } = useExpedienteById(id ?? null);
  const { mutate: registerConsult } = useRegisterConsult();

  const canAccessSensitiveTabs = puedeAccederAgresor(user?.role);
  const canCreate = user ? canLookupPreRegistro(user.role) : false;

  const consultedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!expediente?.id || consultedIdRef.current === expediente.id) return;
    consultedIdRef.current = expediente.id;
    registerConsult(expediente.id);
  }, [expediente?.id, registerConsult]);

  useEffect(() => {
    if (!id) return;
    void queryClient.prefetchQuery(fichaDetailQueryOptions(id));
  }, [id, queryClient]);

  const requestedTab = parseRequestedTab(searchParams.get('tab'));
  const [localTab, setLocalTab] = useState<DrawerTab>(requestedTab);
  const [prevRequestedTab, setPrevRequestedTab] = useState<DrawerTab>(requestedTab);
  if (requestedTab !== prevRequestedTab) {
    setPrevRequestedTab(requestedTab);
    setLocalTab(requestedTab);
  }

  const activeTab: DrawerTab = canAccessSensitiveTabs ? localTab : 'resumen';
  const activeExpedienteId = expediente?.id ?? null;

  const [mountedState, setMountedState] = useState<{
    expedienteId: string | null;
    tabs: DrawerTab[];
  }>({
    expedienteId: activeExpedienteId,
    tabs: [activeTab],
  });
  if (mountedState.expedienteId !== activeExpedienteId) {
    setMountedState({ expedienteId: activeExpedienteId, tabs: [activeTab] });
  }
  const visitedTabs = mountedState.tabs;
  const activeTabMounted = visitedTabs.includes(activeTab);

  // Pinta primero la pestaña activa + esqueleto y monta el panel en el siguiente frame.
  useEffect(() => {
    if (!activeExpedienteId || activeTabMounted) return;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        startTransition(() => {
          setMountedState((prev) => {
            if (prev.expedienteId !== activeExpedienteId || prev.tabs.includes(activeTab)) {
              return prev;
            }
            return { ...prev, tabs: [...prev.tabs, activeTab] };
          });
        });
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [activeExpedienteId, activeTab, activeTabMounted]);

  // Precarga silenciosa en reposo de las pestañas restantes tras 1.2 s (respetando saveData).
  useEffect(() => {
    if (!activeExpedienteId || !canAccessSensitiveTabs) return;
    const nav =
      typeof navigator !== 'undefined'
        ? (navigator as Navigator & { connection?: { saveData?: boolean } })
        : null;
    if (nav?.connection?.saveData) return;

    let cancelled = false;
    let index = 0;
    let cancelIdle: (() => void) | null = null;

    const step = () => {
      if (cancelled || index >= SENSITIVE_TAB_ORDER.length) return;
      preloadExpedienteDrawerTab(SENSITIVE_TAB_ORDER[index++]);
      if (index < SENSITIVE_TAB_ORDER.length) cancelIdle = scheduleIdleStep(step);
    };

    const startTimer = window.setTimeout(() => {
      if (!cancelled) cancelIdle = scheduleIdleStep(step);
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      cancelIdle?.();
    };
  }, [activeExpedienteId, canAccessSensitiveTabs]);

  const tablistRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const [tabMotion, setTabMotion] = useState<{
    count: number;
    dir: 1 | -1;
    deferredReveal: boolean;
  }>({ count: 0, dir: 1, deferredReveal: false });

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((tab) => !tab.sensitive || canAccessSensitiveTabs),
    [canAccessSensitiveTabs],
  );

  // Posiciona la cápsula activa con transform + width (sin reflow en el panel inferior).
  useLayoutEffect(() => {
    const tablist = tablistRef.current;
    const indicator = indicatorRef.current;
    if (!tablist || !indicator) return;

    const positionIndicator = () => {
      const selectedBtn = tablist.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      if (!selectedBtn || selectedBtn.offsetWidth === 0) return;
      indicator.style.width = `${selectedBtn.offsetWidth}px`;
      indicator.style.transform = `translate3d(${selectedBtn.offsetLeft}px, 0, 0)`;
      indicator.style.opacity = '1';
      tablist.dataset.indicatorReady = 'true';
    };

    positionIndicator();

    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(positionIndicator);
    observer.observe(tablist);
    return () => observer.disconnect();
  }, [activeTab, visibleTabs.length, expediente?.id]);

  const selectTab = useCallback(
    (next: DrawerTab) => {
      if (next === activeTab) return;
      const prevIndex = visibleTabs.findIndex((tab) => tab.id === activeTab);
      const nextIndex = visibleTabs.findIndex((tab) => tab.id === next);
      const dir: 1 | -1 = nextIndex >= prevIndex ? 1 : -1;
      const alreadyMounted = visitedTabs.includes(next);

      setTabMotion((prev) => ({
        count: prev.count + 1,
        dir,
        deferredReveal: !alreadyMounted,
      }));
      setLocalTab(next);

      const nextButton = tablistRef.current?.querySelector<HTMLButtonElement>(`#tab-${next}`);
      if (nextButton && typeof nextButton.scrollIntoView === 'function') {
        nextButton.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
      }

      startTransition(() => {
        setSearchParams(
          (prev) => {
            const params = new URLSearchParams(prev);
            if (next === 'resumen') params.delete('tab');
            else params.set('tab', next);
            return params;
          },
          { replace: true },
        );
      });
    },
    [activeTab, visibleTabs, visitedTabs, setSearchParams],
  );

  const handleTabIntent = useCallback(
    (tab: DrawerTab) => {
      if (canAccessSensitiveTabs) preloadExpedienteDrawerTab(tab);
    },
    [canAccessSensitiveTabs],
  );

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = Math.max(
        0,
        visibleTabs.findIndex((tab) => tab.id === activeTab),
      );
      let nextIndex = -1;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % visibleTabs.length;
      else if (event.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
      } else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = visibleTabs.length - 1;
      else return;

      event.preventDefault();
      const target = visibleTabs[nextIndex];
      if (!target) return;
      const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[nextIndex]?.focus();
      selectTab(target.id);
    },
    [visibleTabs, activeTab, selectTab],
  );

  const handleCopyFolio = useCallback(async () => {
    if (!expediente) return;
    const ok = await copyTextToClipboard(expediente.folio);
    toast(ok ? 'Folio copiado al portapapeles.' : 'No se pudo copiar el folio.', {
      tone: ok ? 'success' : 'error',
    });
  }, [expediente]);

  const handleCopyCurp = useCallback(async () => {
    if (!expediente) return;
    const ok = await copyTextToClipboard(expediente.persona.curp);
    toast(ok ? 'CURP copiada al portapapeles.' : 'No se pudo copiar la CURP.', {
      tone: ok ? 'success' : 'error',
    });
  }, [expediente]);

  const handleBackToList = useCallback(() => {
    navigate('/expedientes');
  }, [navigate]);

  const pageTitle =
    expediente?.persona.nombreCompleto ?? (isLoading ? 'Cargando expediente…' : 'Expediente');

  const sensitiveTabs = useMemo(
    () =>
      expediente
        ? ([
          {
            id: 'agresor',
            label: 'Cargando persona agresora',
            node: <AgresorFormSection key={expediente.id} fichaId={expediente.id} />,
          },
          {
            id: 'documentos',
            label: 'Cargando documentos',
            node: <DocumentosAdjuntosPanel key={expediente.id} fichaId={expediente.id} />,
          },
          {
            id: 'canalizaciones',
            label: 'Cargando canalizaciones',
            node: (
              <DerivacionesExpedientePanel
                key={expediente.id}
                fichaId={expediente.id}
                folio={expediente.folio}
              />
            ),
          },
          {
            id: 'ordenes',
            label: 'Cargando órdenes de protección',
            node: <OrdenesProteccionPanel key={expediente.id} fichaId={expediente.id} />,
          },
          {
            id: 'seguimiento',
            label: 'Cargando línea de tiempo',
            node: <ExpedienteTimeline key={expediente.id} fichaId={expediente.id} />,
          },
          {
            id: 'notas',
            label: 'Cargando notas privadas',
            node: <NotasPrivadasPanel key={expediente.id} fichaId={expediente.id} />,
          },
        ] as const)
        : [],
    [expediente],
  );

  return (
    <>
      <PageHeader
        title={pageTitle}
        actions={
          <>
            <button
              type="button"
              className="mk-button mk-button--tonal min-h-11 px-4 text-base"
              onClick={handleBackToList}
            >
              <Icon name="arrow_back" />
              <span>Expedientes</span>
            </button>

            {expediente ? (
              <>
                <button
                  type="button"
                  className="mk-button mk-button--tonal min-h-11 px-4 text-base"
                  onClick={() => void handleCopyFolio()}
                >
                  <Icon name="content_copy" />
                  <span>Copiar folio</span>
                </button>
                <button
                  type="button"
                  className="mk-button mk-button--tonal min-h-11 px-4 text-base"
                  onClick={() => void handleCopyCurp()}
                >
                  <Icon name="badge" />
                  <span>Copiar CURP</span>
                </button>
              </>
            ) : null}
          </>
        }
      />

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudo cargar el expediente"
            description="Verifica tu conexión y permisos en Supabase."
            actions={RETRY_ACTION}
            onAction={() => void refetch()}
          />
        </div>
      ) : isLoading && !expediente ? (
        <PageLoadingSkeleton />
      ) : !expediente ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="inbox"
            title="Expediente no encontrado"
            description="El expediente solicitado no existe, fue desactivado o no tienes acceso."
            actions={BACK_TO_LIST_ACTION}
            onAction={handleBackToList}
          />
        </div>
      ) : (
        <>
          <SummaryStrip expediente={expediente} />

          <div className="sticky top-0 z-20 mx-auto w-full bg-background/95 px-4 py-2.5 sm:px-6">
            <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-low p-1.5">
              <div
                ref={tablistRef}
                role="tablist"
                aria-orientation="horizontal"
                aria-label="Secciones del expediente"
                data-tab-animated={tabMotion.count > 0 ? 'true' : undefined}
                onKeyDown={handleTabKeyDown}
                className="vc-detail-tabs"
              >
                <span
                  ref={indicatorRef}
                  aria-hidden
                  className={`vc-detail-tabs__indicator ${tabMotion.count === 0 ? 'vc-detail-tabs__indicator--instant' : ''
                    }`.trim()}
                />
                {visibleTabs.map((tab) => {
                  const selected = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      id={`tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`panel-${tab.id}`}
                      tabIndex={selected ? 0 : -1}
                      onPointerEnter={() => handleTabIntent(tab.id)}
                      onFocus={() => handleTabIntent(tab.id)}
                      onClick={() => selectTab(tab.id)}
                      className="vc-detail-tabs__tab"
                    >
                      <Icon
                        name={tab.icon}
                        className="vc-detail-tabs__icon text-[20px]"
                        filled={selected}
                      />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mx-auto w-full min-w-0 px-4 pt-4 sm:px-6">
            {(() => {
              const enterClass =
                tabMotion.count === 0
                  ? ''
                  : tabMotion.dir > 0
                    ? 'vc-tab-panel--enter-right'
                    : 'vc-tab-panel--enter-left';
              const panelClass = tabMotion.deferredReveal ? 'vc-tab-panel--reveal' : enterClass;

              return (
                <>
                  {!activeTabMounted ? (
                    <div role="tabpanel" className={enterClass}>
                      <SectionSkeleton label="Cargando sección" />
                    </div>
                  ) : null}

                  {visitedTabs.includes('resumen') ? (
                    <div
                      id="panel-resumen"
                      role="tabpanel"
                      aria-labelledby="tab-resumen"
                      hidden={activeTab !== 'resumen'}
                      className={activeTab === 'resumen' ? `grid gap-6 ${panelClass}`.trim() : 'hidden'}
                    >
                      <ExpedienteContactoSection expediente={expediente} />
                      <FichaDetalleResumen expediente={expediente} />
                      {canCreate ? (
                        <FichaGestionAcciones expediente={expediente} onDone={handleBackToList} />
                      ) : null}
                    </div>
                  ) : null}

                  {canAccessSensitiveTabs
                    ? sensitiveTabs.map(({ id: tabId, label, node }) =>
                      visitedTabs.includes(tabId) ? (
                        <LazyTabPanel
                          key={tabId}
                          id={`panel-${tabId}`}
                          labelledBy={`tab-${tabId}`}
                          active={activeTab === tabId}
                          motionClass={panelClass}
                          label={label}
                        >
                          {node}
                        </LazyTabPanel>
                      ) : null,
                    )
                    : null}
                </>
              );
            })()}
          </div>
        </>
      )}
    </>
  );
}
