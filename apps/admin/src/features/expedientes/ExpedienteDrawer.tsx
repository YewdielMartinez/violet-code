import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
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
import { AgresorFormSection } from './AgresorFormSection';
import { DerivacionesExpedientePanel } from './DerivacionesExpedientePanel';
import { DocumentosAdjuntosPanel } from './DocumentosAdjuntosPanel';
import { ExpedienteContactoSection } from './drawer/ExpedienteContactoSection';
import { ExpedienteDrawerTabs, type DrawerTab } from './drawer/ExpedienteDrawerTabs';
import { ExpedienteHeroCard } from './drawer/ExpedienteHeroCard';
import { ExpedienteTopBar } from './drawer/ExpedienteTopBar';
import { prefersReducedMotion } from './drawer/formatters';
import './drawer/expediente-drawer.css';
import { FichaDetalleResumen } from './ficha/FichaDetalleResumen';
import { FichaGestionAcciones } from './ficha/FichaGestionAcciones';

// El morph de apertura de motion-kit dura 0.7 s (TIMING.dialog.open). Montar el detalle a la mitad
// provocaba un tirón; se monta al terminar y mientras tanto se ve el placeholder ligero.
const DEFERRED_CONTENT_DELAY_MS = 700;
// El cierre de motion-kit (morphCloseWithGhost) dura 0.5 s (TIMING.dialog.close) y anima una copia
// del panel. Durante ese tiempo no tocamos la URL ni el árbol de React: cualquier render a mitad
// de la animación se notaba como un "frenón".
const CLOSE_ANIMATION_MS = 550;

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
  // Cierre en dos fases sin renders a mitad de animación: el kit ya cerró el <dialog> y anima su
  // ghost; la URL (y con ella la limpieza) se actualiza al terminar. `open` sigue en true mientras
  // tanto, pero el wrapper del kit solo sincroniza cuando la prop cambia, así que no reabre.
  const closingIdRef = useRef<string | null>(null);
  const closeTimerRef = useRef(0);
  // Si se abre otro expediente mientras el anterior termina de cerrarse, `open` no cambia (true → true)
  // y el kit no lo abriría: se remonta el Dialog con una generación nueva.
  const [generation, setGeneration] = useState(0);
  useLayoutEffect(() => {
    const pending = closingIdRef.current;
    if (!pending || !expediente || expediente.id === pending) return;
    window.clearTimeout(closeTimerRef.current);
    closingIdRef.current = null;
    setGeneration((g) => g + 1);
  }, [expediente]);
  const [contentReady, setContentReady] = useState(() => isOpen && prefersReducedMotion());

  const rawTab = searchParams.get('tab');
  const requestedTab: DrawerTab =
    rawTab === 'agresor' || rawTab === 'documentos' || rawTab === 'canalizaciones'
      ? rawTab
      : 'resumen';
  const activeTab: DrawerTab = canAccessSensitiveTabs ? requestedTab : 'resumen';

  // Workaround motion-kit 0.20.3: `createDialog.close()` llama a `dialog.close()` sin incrementar
  // `ownCloses`. Si el diálogo se reabre antes de que se despache el evento nativo `close` en cola,
  // ese evento obsoleto desincronizaría `isOpen` dejando `<dialog open>` atascado en pantalla.
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

  // Tras el cierre (después del useLayoutEffect donde Dialog cierra y clona el ghost), limpia el
  // contenido retenido y garantiza que el <dialog> nativo no quede abierto por ningún race.
  useEffect(() => {
    if (expediente) return;

    const dialogEl = hostRef.current?.querySelector('dialog');
    if (dialogEl && dialogEl.hasAttribute('open')) {
      if (typeof dialogEl.close === 'function') dialogEl.close();
      else dialogEl.removeAttribute('open');
    }

    // Desmontar el contenido a mitad del morph de cierre (p. ej. "atrás" del navegador) se nota:
    // se limpia cuando la animación ya terminó.
    const timer = window.setTimeout(() => {
      setDisplayed((prev) => (prev ? null : prev));
      setExpanded((prev) => (prev ? false : prev));
      setContentReady((prev) => (prev ? false : prev));
    }, prefersReducedMotion() ? 0 : CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [expediente]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  // Difiere el montaje de consultas/secciones pesadas (FichaDetalleResumen, FuseButton, Agresor,
  // Documentos, Canalizaciones) hasta pasar los primeros frames del morphOpen.
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

  const finishClose = useCallback(() => {
    closingIdRef.current = null;
    // motion-kit 0.20.3 también llama a onClose desde destroy() (StrictMode monta dos veces) y el
    // diálogo se vuelve a abrir enseguida: si sigue abierto, no fue un cierre real.
    if (hostRef.current?.querySelector('dialog')?.open) return;
    startTransition(() => onClose());
  }, [onClose]);

  /** Tras un cierre del kit (X, Escape, backdrop): espera la animación y luego limpia la URL. */
  const scheduleClose = useCallback(() => {
    if (!expediente || closingIdRef.current === expediente.id) return;
    closingIdRef.current = expediente.id;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(
      finishClose,
      prefersReducedMotion() ? 0 : CLOSE_ANIMATION_MS,
    );
  }, [expediente, finishClose]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) scheduleClose();
    },
    [scheduleClose],
  );

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
    () => ({ '--vc-drawer-width': expanded ? '960px' : '680px' }) as CSSProperties,
    [expanded],
  );

  const dialogAnchor = anchor ?? originElement ?? null;
  const activeExpediente = expediente ?? displayed;

  return (
    <div ref={hostRef}>
      <Dialog.Root
        key={generation}
        placement="side"
        variant="morph"
        animateContent={false}
        autoResize={false}
        drag={false}
        anchor={dialogAnchor}
        open={isOpen}
        onOpenChange={handleOpenChange}
      >
        <Dialog.Content className="vc-expediente-dialog" style={widthStyle}>
          <ExpedienteTopBar
            expediente={activeExpediente}
            expanded={expanded}
            onToggleExpand={handleToggleExpand}
          />

          <Dialog.Body>
            {activeExpediente ? (
              <div className="grid gap-5">
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
                      <AgresorFormSection key={activeExpediente.id} fichaId={activeExpediente.id} />
                    ) : (
                      <DrawerSectionPlaceholder label="Cargando persona agresora" />
                    )}
                  </div>
                ) : null}

                {canAccessSensitiveTabs && activeTab === 'documentos' ? (
                  <div role="tabpanel">
                    {contentReady ? (
                      <DocumentosAdjuntosPanel
                        key={activeExpediente.id}
                        fichaId={activeExpediente.id}
                      />
                    ) : (
                      <DrawerSectionPlaceholder label="Cargando documentos" />
                    )}
                  </div>
                ) : null}

                {canAccessSensitiveTabs && activeTab === 'canalizaciones' ? (
                  <div role="tabpanel">
                    {contentReady ? (
                      <DerivacionesExpedientePanel
                        key={activeExpediente.id}
                        fichaId={activeExpediente.id}
                        folio={activeExpediente.folio}
                      />
                    ) : (
                      <DrawerSectionPlaceholder label="Cargando canalizaciones" />
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
