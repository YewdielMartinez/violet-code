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
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import gsap from 'gsap';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import type { StaffRole } from '@/domain/models/Auth';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { puedeAccederAgresor } from './agresorApi';
import { ExpedienteContactoSection } from './drawer/ExpedienteContactoSection';
import { ExpedienteDrawerTabs, type DrawerTab } from './drawer/ExpedienteDrawerTabs';
import { ExpedienteHeroCard } from './drawer/ExpedienteHeroCard';
import { ExpedienteTopBar } from './drawer/ExpedienteTopBar';
import { prefersReducedMotion } from './drawer/formatters';
import './drawer/expediente-drawer.css';
import { FichaDetalleResumen } from './ficha/FichaDetalleResumen';
import { FichaGestionAcciones } from './ficha/FichaGestionAcciones';

// Pestañas sensibles en chunks propios: solo las descarga quien tiene acceso y las abre.
const loadAgresorFormSection = () => import('./AgresorFormSection');
const loadDocumentosAdjuntosPanel = () => import('./DocumentosAdjuntosPanel');
const loadDerivacionesExpedientePanel = () => import('./DerivacionesExpedientePanel');
const loadOrdenesProteccionPanel = () => import('@/features/solicitudes/OrdenesProteccionPanel');
const loadExpedienteTimeline = () => import('@/features/intervenciones/ExpedienteTimeline');
const loadNotasPrivadasPanel = () => import('@/features/intervenciones/NotasPrivadasPanel');
const AgresorFormSection = lazy(() => loadAgresorFormSection().then((m) => ({ default: m.AgresorFormSection })));
const DocumentosAdjuntosPanel = lazy(() =>
  loadDocumentosAdjuntosPanel().then((m) => ({ default: m.DocumentosAdjuntosPanel })),
);
const DerivacionesExpedientePanel = lazy(() =>
  loadDerivacionesExpedientePanel().then((m) => ({ default: m.DerivacionesExpedientePanel })),
);

const OrdenesProteccionPanel = lazy(() =>
  loadOrdenesProteccionPanel().then((m) => ({ default: m.OrdenesProteccionPanel })),
);

const ExpedienteTimeline = lazy(() =>
  loadExpedienteTimeline().then((m) => ({ default: m.ExpedienteTimeline })),
);
const NotasPrivadasPanel = lazy(() =>
  loadNotasPrivadasPanel().then((m) => ({ default: m.NotasPrivadasPanel })),
);

const TAB_LOADERS: Partial<Record<DrawerTab, () => Promise<unknown>>> = {
  agresor: loadAgresorFormSection,
  documentos: loadDocumentosAdjuntosPanel,
  canalizaciones: loadDerivacionesExpedientePanel,
  ordenes: loadOrdenesProteccionPanel,
  seguimiento: loadExpedienteTimeline,
  notas: loadNotasPrivadasPanel,
};

const IDLE_TAB_ORDER: readonly DrawerTab[] = [
  'agresor',
  'documentos',
  'canalizaciones',
  'ordenes',
  'seguimiento',
  'notas',
];

const preloadedTabs = new Set<DrawerTab>();

/** Precarga únicamente el chunk de la pestaña solicitada (hover/focus en la pestaña). */
export function preloadExpedienteDrawerTab(tab: DrawerTab): void {
  if (preloadedTabs.has(tab)) return;
  const load = TAB_LOADERS[tab];
  if (!load) return;
  preloadedTabs.add(tab);
  void load();
}

let tabsPreloaded = false;

/** Precarga las pestañas sensibles principales cuando el llamador lo solicita explícitamente. */
export function preloadExpedienteDrawerTabs(): void {
  if (tabsPreloaded) return;
  tabsPreloaded = true;
  preloadExpedienteDrawerTab('agresor');
  preloadExpedienteDrawerTab('documentos');
  preloadExpedienteDrawerTab('canalizaciones');
  preloadExpedienteDrawerTab('ordenes');
}

function scheduleIdleTab(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => { };
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(cb, { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 150);
  return () => window.clearTimeout(id);
}

// El morph de apertura de motion-kit dura 0.7 s (TIMING.dialog.open). Montar el detalle a la mitad
// provocaba un tirón; se monta al terminar y mientras tanto se ve el placeholder ligero.
const DEFERRED_CONTENT_DELAY_MS = 700;

function settleDeepLinkDialog(dialog: HTMLDialogElement) {
  gsap.killTweensOf(dialog);
  gsap.set(dialog, { clearProps: 'transform,translate,rotate,scale,opacity,clipPath,borderRadius' });
  dialog.querySelectorAll('.mk-morph-face').forEach((el) => el.remove());
}

const DrawerSectionPlaceholder = memo(function DrawerSectionPlaceholder({
  label,
}: {
  label: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="grid min-h-[320px] content-start gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-40 rounded-full bg-surface-container-high animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-28 rounded-full bg-surface-container animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-16 rounded-xl bg-surface-container animate-pulse motion-reduce:animate-none" />
        <div className="h-16 rounded-xl bg-surface-container animate-pulse motion-reduce:animate-none" />
        <div className="h-24 rounded-xl bg-surface-container animate-pulse motion-reduce:animate-none sm:col-span-2" />
      </div>
    </div>
  );
});

interface ResumenTabPanelProps {
  expediente: ExpedienteResumen;
  canManage: boolean;
  contentReady: boolean;
  active: boolean;
  onDone: () => void;
}

const ResumenTabPanel = memo(function ResumenTabPanel({
  expediente,
  canManage,
  contentReady,
  active,
  onDone,
}: ResumenTabPanelProps) {
  return (
    <div role="tabpanel" hidden={!active} className={active ? 'grid gap-6' : 'hidden'}>
      <ExpedienteContactoSection expediente={expediente} />
      {contentReady ? (
        <>
          <FichaDetalleResumen expediente={expediente} />
          {canManage ? <FichaGestionAcciones expediente={expediente} onDone={onDone} /> : null}
        </>
      ) : (
        <DrawerSectionPlaceholder label="Cargando detalle del expediente" />
      )}
    </div>
  );
});

interface LazyTabPanelProps {
  active: boolean;
  contentReady: boolean;
  label: string;
  children: ReactNode;
}

const LazyTabPanel = memo(function LazyTabPanel({
  active,
  contentReady,
  label,
  children,
}: LazyTabPanelProps) {
  return (
    <div role="tabpanel" hidden={!active} className={active ? undefined : 'hidden'}>
      {contentReady ? (
        <Suspense fallback={<DrawerSectionPlaceholder label={label} />}>{children}</Suspense>
      ) : (
        <DrawerSectionPlaceholder label={label} />
      )}
    </div>
  );
});

interface Props {
  expediente: ExpedienteResumen | null;
  anchor?: RefObject<HTMLElement | null> | HTMLElement | null;
  originElement?: HTMLElement | null;
  fromUserInteraction?: boolean;
  userRole: StaffRole | undefined;
  canManage: boolean;
  onClose: () => void;
}

/**
 * Panel lateral derecho de expediente (`RF-05`, `RF-22`).
 * Usa `Dialog` (motion-kit 0.20.3) con `placement="side"`, `variant="morph"` al abrir desde una fila
 * (y `variant="fade"` en deep-link para montar de inmediato sin esperar el morph).
 * Mantiene ocultas «Persona agresora», «Documentos» y «Canalizaciones» para `recepcion` y `umeca`.
 */
export const ExpedienteDrawer = memo(function ExpedienteDrawer({
  expediente,
  anchor = null,
  originElement = null,
  fromUserInteraction = false,
  userRole,
  canManage,
  onClose,
}: Props) {
  const canAccessSensitiveTabs = puedeAccederAgresor(userRole);
  const hostRef = useRef<HTMLDivElement>(null);
  const bodyInnerRef = useRef<HTMLDivElement>(null);

  const [expanded, setExpanded] = useState(false);
  // Conserva el último expediente durante el cierre para que el ghost de morphCloseWithGhost
  // capture el contenido real en lugar de un cascarón vacío; se limpia tras cerrar el <dialog>.
  const [displayed, setDisplayed] = useState<ExpedienteResumen | null>(expediente);
  if (expediente && displayed !== expediente) {
    setDisplayed(expediente);
  }

  // La pestaña activa vive en la URL (`?tab=`), igual que el expediente abierto (`?expediente=`).
  const [searchParams, setSearchParams] = useSearchParams();

  const isOpen = Boolean(expediente);
  const expedienteRef = useRef(expediente);
  const fromUserInteractionRef = useRef(fromUserInteraction);
  useLayoutEffect(() => {
    expedienteRef.current = expediente;
    fromUserInteractionRef.current = fromUserInteraction;
  }, [expediente, fromUserInteraction]);

  const shouldDeferContent = fromUserInteraction && !prefersReducedMotion();
  const [deferredReady, setDeferredReady] = useState(false);
  const contentReady = (isOpen && !shouldDeferContent) || deferredReady;

  const rawTab = searchParams.get('tab');
  const requestedTab: DrawerTab =
    rawTab === 'agresor' ||
      rawTab === 'documentos' ||
      rawTab === 'canalizaciones' ||
      rawTab === 'ordenes' ||
      rawTab === 'seguimiento' ||
      rawTab === 'notas'
      ? rawTab
      : 'resumen';

  const [localTab, setLocalTab] = useState<DrawerTab>(requestedTab);
  const [prevRequestedTab, setPrevRequestedTab] = useState<DrawerTab>(requestedTab);
  if (requestedTab !== prevRequestedTab) {
    setPrevRequestedTab(requestedTab);
    setLocalTab(requestedTab);
  }

  const activeTab: DrawerTab = canAccessSensitiveTabs ? localTab : 'resumen';
  const activeExpedienteId = (expediente ?? displayed)?.id ?? null;

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

  // Al cambiar a una pestaña aún no montada, pinta primero el pill activo + esqueleto
  // y monta el panel real en el siguiente frame para no congelar la animación del clic.
  useEffect(() => {
    if (!isOpen || !activeExpedienteId || activeTabMounted) return;
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
  }, [isOpen, activeExpedienteId, activeTab, activeTabMounted]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    function ignoreStaleClose(event: Event) {
      const target = event.target;
      if (target instanceof HTMLDialogElement && target.hasAttribute('open')) {
        event.stopPropagation();
      }
    }
    host.addEventListener('close', ignoreStaleClose, true);
    return () => host.removeEventListener('close', ignoreStaleClose, true);
  }, []);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onMkOpen = (event: Event) => {
      if (fromUserInteractionRef.current) return;
      const target = event.target;
      if (target instanceof HTMLDialogElement && target.classList.contains('vc-expediente-dialog')) {
        settleDeepLinkDialog(target);
      }
    };
    host.addEventListener('mk:open', onMkOpen);
    return () => host.removeEventListener('mk:open', onMkOpen);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || fromUserInteraction) return;
    const dialog = hostRef.current?.querySelector<HTMLDialogElement>('dialog.vc-expediente-dialog');
    if (dialog) settleDeepLinkDialog(dialog);
  }, [isOpen, fromUserInteraction]);

  // Cuando se abre por interacción con morph, difiere el montaje de secciones pesadas hasta pasar
  // los primeros frames del morphOpen; en deep-link o movimiento reducido monta de inmediato.
  useEffect(() => {
    if (!isOpen) return;
    if (!shouldDeferContent) {
      setDeferredReady(true);
      return;
    }

    let timerId = 0;
    const rafId = window.requestAnimationFrame(() => {
      timerId = window.setTimeout(() => {
        startTransition(() => {
          setDeferredReady(true);
        });
      }, DEFERRED_CONTENT_DELAY_MS);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [isOpen, shouldDeferContent]);

  useEffect(() => {
    if (!isOpen || !contentReady || !canAccessSensitiveTabs) return;
    const nav =
      typeof navigator !== 'undefined'
        ? (navigator as Navigator & { connection?: { saveData?: boolean } })
        : null;
    if (nav?.connection?.saveData) return;

    let cancelled = false;
    let index = 0;
    let cancelIdle: (() => void) | null = null;

    const step = () => {
      while (index < IDLE_TAB_ORDER.length && preloadedTabs.has(IDLE_TAB_ORDER[index])) index++;
      if (cancelled || index >= IDLE_TAB_ORDER.length) return;
      preloadExpedienteDrawerTab(IDLE_TAB_ORDER[index++]);
      if (index < IDLE_TAB_ORDER.length) cancelIdle = scheduleIdleTab(step);
    };

    const startTimer = window.setTimeout(() => {
      if (!cancelled) cancelIdle = scheduleIdleTab(step);
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      cancelIdle?.();
    };
  }, [isOpen, contentReady, canAccessSensitiveTabs]);

  const handleTabIntent = useCallback(
    (tab: DrawerTab) => {
      if (canAccessSensitiveTabs) preloadExpedienteDrawerTab(tab);
    },
    [canAccessSensitiveTabs],
  );

  const selectTab = useCallback(
    (next: DrawerTab) => {
      if (!isOpen || next === activeTab) return;
      setLocalTab(next);
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
    [isOpen, activeTab, setSearchParams],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) startTransition(() => onClose());
    },
    [onClose],
  );

  const handleAfterClose = useCallback(() => {
    if (expedienteRef.current) return;
    setDisplayed(null);
    setExpanded(false);
    setDeferredReady(false);
    setMountedState({ expedienteId: null, tabs: ['resumen'] });
  }, []);

  /** Cierre pedido por la app (botón del pie, archivar): mismo camino que la X del kit. */
  const requestClose = useCallback(() => {
    const close = hostRef.current?.querySelector<HTMLButtonElement>('[data-mk-part="close"]');
    if (close) close.click();
    else onClose();
  }, [onClose]);

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);


  const widthStyle = useMemo(
    () => ({ '--vc-drawer-width': expanded ? 'calc(100vw - 16px)' : '680px' }) as CSSProperties,
    [expanded],
  );

  const dialogAnchor = anchor ?? originElement ?? null;
  const activeExpediente = expediente ?? displayed;

  // Evita que cerrar o interactuar con un diálogo anidado (Agresor, Órdenes, Canalizaciones)
  // burbujee eventos de cierre/clic hasta el <dialog> exterior de ExpedienteDrawer.
  useEffect(() => {
    const body = bodyInnerRef.current;
    if (!body) return;
    function stopNestedDialogEvents(event: Event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const closestDialog = target.closest('dialog');
      const outerDialog = hostRef.current?.querySelector('dialog.vc-expediente-dialog');
      if (!closestDialog || closestDialog === outerDialog) return;
      if (event.type === 'click' && !target.closest('[data-mk-part="close"], [data-mk-close]')) {
        return;
      }
      event.stopPropagation();
    }
    const EVENTS = ['click', 'cancel', 'close', 'mk:close', 'mk:closed'] as const;
    for (const type of EVENTS) body.addEventListener(type, stopNestedDialogEvents);
    return () => {
      for (const type of EVENTS) body.removeEventListener(type, stopNestedDialogEvents);
    };
  }, [activeExpediente]);

  return (
    <div ref={hostRef}>
      <Dialog.Root
        placement="side"
        variant="morph"
        animateContent={false}
        autoResize={false}
        drag={false}
        anchor={dialogAnchor}
        open={isOpen}
        onOpenChange={handleOpenChange}
        onAfterClose={handleAfterClose}
      >
        <Dialog.Content className="vc-expediente-dialog" style={widthStyle}>
          <ExpedienteTopBar
            expediente={activeExpediente}
            expanded={expanded}
            onToggleExpand={handleToggleExpand}
          />

          <Dialog.Body>
            {activeExpediente ? (
              <div ref={bodyInnerRef} className="grid gap-5">
                <ExpedienteHeroCard expediente={activeExpediente} />

                <ExpedienteDrawerTabs
                  activeTab={activeTab}
                  canAccessSensitiveTabs={canAccessSensitiveTabs}
                  onChange={selectTab}
                  onTabIntent={handleTabIntent}
                />

                {!activeTabMounted ? (
                  <div role="tabpanel">
                    <DrawerSectionPlaceholder label="Cargando sección" />
                  </div>
                ) : null}

                {visitedTabs.includes('resumen') ? (
                  <ResumenTabPanel
                    expediente={activeExpediente}
                    canManage={canManage}
                    contentReady={contentReady}
                    active={activeTab === 'resumen'}
                    onDone={requestClose}
                  />
                ) : null}

                {canAccessSensitiveTabs && visitedTabs.includes('agresor') ? (
                  <LazyTabPanel
                    active={activeTab === 'agresor'}
                    contentReady={contentReady}
                    label="Cargando persona agresora"
                  >
                    <AgresorFormSection key={activeExpediente.id} fichaId={activeExpediente.id} />
                  </LazyTabPanel>
                ) : null}

                {canAccessSensitiveTabs && visitedTabs.includes('documentos') ? (
                  <LazyTabPanel
                    active={activeTab === 'documentos'}
                    contentReady={contentReady}
                    label="Cargando documentos"
                  >
                    <DocumentosAdjuntosPanel key={activeExpediente.id} fichaId={activeExpediente.id} />
                  </LazyTabPanel>
                ) : null}

                {canAccessSensitiveTabs && visitedTabs.includes('canalizaciones') ? (
                  <LazyTabPanel
                    active={activeTab === 'canalizaciones'}
                    contentReady={contentReady}
                    label="Cargando canalizaciones"
                  >
                    <DerivacionesExpedientePanel
                      key={activeExpediente.id}
                      fichaId={activeExpediente.id}
                      folio={activeExpediente.folio}
                    />
                  </LazyTabPanel>
                ) : null}

                {canAccessSensitiveTabs && visitedTabs.includes('seguimiento') ? (
                  <LazyTabPanel
                    active={activeTab === 'seguimiento'}
                    contentReady={contentReady}
                    label="Cargando línea de tiempo"
                  >
                    <ExpedienteTimeline key={activeExpediente.id} fichaId={activeExpediente.id} />
                  </LazyTabPanel>
                ) : null}

                {canAccessSensitiveTabs && visitedTabs.includes('notas') ? (
                  <LazyTabPanel
                    active={activeTab === 'notas'}
                    contentReady={contentReady}
                    label="Cargando notas privadas"
                  >
                    <NotasPrivadasPanel key={activeExpediente.id} fichaId={activeExpediente.id} />
                  </LazyTabPanel>
                ) : null}

                {canAccessSensitiveTabs && visitedTabs.includes('ordenes') ? (
                  <LazyTabPanel
                    active={activeTab === 'ordenes'}
                    contentReady={contentReady}
                    label="Cargando órdenes de protección"
                  >
                    <OrdenesProteccionPanel key={activeExpediente.id} fichaId={activeExpediente.id} />
                  </LazyTabPanel>
                ) : null}
              </div>
            ) : null}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
});
