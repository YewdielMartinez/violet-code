import {
  lazy,
  memo,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useSearchParams } from 'react-router-dom';
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

let tabsPreloaded = false;

/** Precarga las pestañas sensibles (p. ej. al pasar el cursor por una fila o al abrir el panel). */
export function preloadExpedienteDrawerTabs(): void {
  if (tabsPreloaded) return;
  tabsPreloaded = true;
  void loadAgresorFormSection();
  void loadDocumentosAdjuntosPanel();
  void loadDerivacionesExpedientePanel();
  void loadOrdenesProteccionPanel();
}

// El morph de apertura de motion-kit dura 0.7 s (TIMING.dialog.open). Montar el detalle a la mitad
// provocaba un tirón; se monta al terminar y mientras tanto se ve el placeholder ligero.
const DEFERRED_CONTENT_DELAY_MS = 700;

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
      className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4"
    >
      <div className="h-3.5 w-32 rounded-full bg-surface-container-high animate-pulse motion-reduce:animate-none" />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="h-14 rounded-xl bg-surface-container animate-pulse motion-reduce:animate-none" />
        <div className="h-14 rounded-xl bg-surface-container animate-pulse motion-reduce:animate-none" />
        <div className="h-14 rounded-xl bg-surface-container animate-pulse motion-reduce:animate-none sm:col-span-2" />
      </div>
    </div>
  );
});

interface ResumenTabPanelProps {
  expediente: ExpedienteResumen;
  canManage: boolean;
  contentReady: boolean;
  onDone: () => void;
}

const ResumenTabPanel = memo(function ResumenTabPanel({
  expediente,
  canManage,
  contentReady,
  onDone,
}: ResumenTabPanelProps) {
  return (
    <div role="tabpanel" className="grid gap-6">
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

interface Props {
  expediente: ExpedienteResumen | null;
  anchor?: RefObject<HTMLElement | null> | HTMLElement | null;
  originElement?: HTMLElement | null;
  userRole: StaffRole | undefined;
  canManage: boolean;
  onClose: () => void;
}

/**
 * Panel lateral derecho de expediente (`RF-05`, `RF-22`).
 * Usa `Dialog` (motion-kit 0.20.3) con `placement="side"`, `variant="morph"` y `anchor` nativo
 * para crecer desde la fila origen.
 * Mantiene ocultas «Persona agresora», «Documentos» y «Canalizaciones» para `recepcion` y `umeca`.
 */
export const ExpedienteDrawer = memo(function ExpedienteDrawer({
  expediente,
  anchor = null,
  originElement = null,
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
  expedienteRef.current = expediente;
  const [contentReady, setContentReady] = useState(() => isOpen && prefersReducedMotion());

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
  const activeTab: DrawerTab = canAccessSensitiveTabs ? requestedTab : 'resumen';

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

  // Difiere el montaje de consultas/secciones pesadas (FichaDetalleResumen, FuseButton, Agresor,
  // Documentos, Canalizaciones) hasta pasar los primeros frames del morphOpen.
  // Aprovecha el morph de apertura (~0.7 s) para traer las pestañas antes de que hagan falta.
  useEffect(() => {
    if (isOpen && canAccessSensitiveTabs) preloadExpedienteDrawerTabs();
  }, [isOpen, canAccessSensitiveTabs]);

  useEffect(() => {
    if (!isOpen) return;
    if (prefersReducedMotion()) {
      setContentReady(true);
      return;
    }

    let timerId = 0;
    const rafId = window.requestAnimationFrame(() => {
      timerId = window.setTimeout(() => {
        startTransition(() => {
          setContentReady(true);
        });
      }, DEFERRED_CONTENT_DELAY_MS);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [isOpen]);

  const selectTab = useCallback(
    (next: DrawerTab) => {
      if (!isOpen || next === activeTab) return;
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
    setContentReady(false);
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
      if (closestDialog && closestDialog !== outerDialog) {
        event.stopPropagation();
      }
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
                />

                {activeTab === 'resumen' ? (
                  <ResumenTabPanel
                    expediente={activeExpediente}
                    canManage={canManage}
                    contentReady={contentReady}
                    onDone={requestClose}
                  />
                ) : null}

                {canAccessSensitiveTabs && activeTab === 'agresor' ? (
                  <div role="tabpanel">
                    {contentReady ? (
                      <Suspense fallback={<DrawerSectionPlaceholder label="Cargando persona agresora" />}>
                        <AgresorFormSection key={activeExpediente.id} fichaId={activeExpediente.id} />
                      </Suspense>
                    ) : (
                      <DrawerSectionPlaceholder label="Cargando persona agresora" />
                    )}
                  </div>
                ) : null}

                {canAccessSensitiveTabs && activeTab === 'documentos' ? (
                  <div role="tabpanel">
                    {contentReady ? (
                      <Suspense fallback={<DrawerSectionPlaceholder label="Cargando documentos" />}>
                        <DocumentosAdjuntosPanel
                          key={activeExpediente.id}
                          fichaId={activeExpediente.id}
                        />
                      </Suspense>
                    ) : (
                      <DrawerSectionPlaceholder label="Cargando documentos" />
                    )}
                  </div>
                ) : null}

                {canAccessSensitiveTabs && activeTab === 'canalizaciones' ? (
                  <div role="tabpanel">
                    {contentReady ? (
                      <Suspense fallback={<DrawerSectionPlaceholder label="Cargando canalizaciones" />}>
                        <DerivacionesExpedientePanel
                          key={activeExpediente.id}
                          fichaId={activeExpediente.id}
                          folio={activeExpediente.folio}
                        />
                      </Suspense>
                    ) : (
                      <DrawerSectionPlaceholder label="Cargando canalizaciones" />
                    )}
                  </div>
                ) : null}

                {canAccessSensitiveTabs && activeTab === 'seguimiento' ? (
                  <div role="tabpanel">
                    {contentReady ? (
                      <Suspense fallback={<DrawerSectionPlaceholder label="Cargando línea de tiempo" />}>
                        <ExpedienteTimeline key={activeExpediente.id} fichaId={activeExpediente.id} />
                      </Suspense>
                    ) : (
                      <DrawerSectionPlaceholder label="Cargando línea de tiempo" />
                    )}
                  </div>
                ) : null}

                {canAccessSensitiveTabs && activeTab === 'notas' ? (
                  <div role="tabpanel">
                    {contentReady ? (
                      <Suspense fallback={<DrawerSectionPlaceholder label="Cargando notas privadas" />}>
                        <NotasPrivadasPanel key={activeExpediente.id} fichaId={activeExpediente.id} />
                      </Suspense>
                    ) : (
                      <DrawerSectionPlaceholder label="Cargando notas privadas" />
                    )}
                  </div>
                ) : null}

                {canAccessSensitiveTabs && activeTab === 'ordenes' ? (
                  <div role="tabpanel">
                    {contentReady ? (
                      <Suspense fallback={<DrawerSectionPlaceholder label="Cargando órdenes de protección" />}>
                        <OrdenesProteccionPanel key={activeExpediente.id} fichaId={activeExpediente.id} />
                      </Suspense>
                    ) : (
                      <DrawerSectionPlaceholder label="Cargando órdenes de protección" />
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
});
