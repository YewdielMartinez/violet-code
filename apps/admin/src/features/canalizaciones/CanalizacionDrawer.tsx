import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import { prefersReducedMotion } from '@/features/expedientes/drawer/formatters';
import type { DerivacionItem, EstadoDerivacion } from './api';
import { CanalizacionDrawerActions } from './CanalizacionDrawerActions';
import { CanalizacionHeroCard, CanalizacionSections, CanalizacionTopBar } from './CanalizacionDrawerParts';
import './canalizacion-drawer.css';

// El morph de apertura de motion-kit dura 0.7 s: lo pesado (FuseButton) se monta al terminar.
const DEFERRED_CONTENT_DELAY_MS = 700;
// El cierre (morphCloseWithGhost) dura 0.5 s: hasta entonces no se toca el estado del padre.
const CLOSE_ANIMATION_MS = 550;

interface Props {
  derivacion: DerivacionItem | null;
  anchor?: RefObject<HTMLElement | null> | HTMLElement | null;
  updatingId: string | null;
  onUpdateEstado: (id: string, next: EstadoDerivacion) => Promise<void>;
  onOpenExpediente: (fichaId: string) => void;
  onClose: () => void;
}

/**
 * Panel lateral derecho con el detalle de una canalización (`RF-08`).
 * Misma línea que `ExpedienteDrawer`: `Dialog` side + morph desde la fila, sin viaje de texto
 * compartido ni blur de fondo, contenido pesado diferido y cierre en dos fases.
 */
export const CanalizacionDrawer = memo(function CanalizacionDrawer({
  derivacion,
  anchor = null,
  updatingId,
  onUpdateEstado,
  onOpenExpediente,
  onClose,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const isOpen = Boolean(derivacion);

  // Conserva la última canalización durante el cierre para que el ghost capture contenido real.
  const [displayed, setDisplayed] = useState<DerivacionItem | null>(derivacion);
  if (derivacion && displayed !== derivacion) setDisplayed(derivacion);
  const active = derivacion ?? displayed;

  const closingIdRef = useRef<string | null>(null);
  const closeTimerRef = useRef(0);
  // Si se abre otra canalización mientras la anterior termina de cerrarse, `open` no cambia y el kit
  // no la abriría: se remonta el Dialog con una generación nueva.
  const [generation, setGeneration] = useState(0);
  useLayoutEffect(() => {
    const pending = closingIdRef.current;
    if (!pending || !derivacion || derivacion.id === pending) return;
    window.clearTimeout(closeTimerRef.current);
    closingIdRef.current = null;
    setGeneration((g) => g + 1);
  }, [derivacion]);

  const [contentReady, setContentReady] = useState(() => isOpen && prefersReducedMotion());

  // Workaround motion-kit 0.20.x: un evento `close` obsoleto en cola tras reabrir dejaría
  // `isOpen` desincronizado; se ignora si el <dialog> sigue abierto.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    function ignoreStaleClose(event: Event) {
      const target = event.target;
      if (target instanceof HTMLDialogElement && target.hasAttribute('open')) event.stopPropagation();
    }
    host.addEventListener('close', ignoreStaleClose, true);
    return () => host.removeEventListener('close', ignoreStaleClose, true);
  }, []);

  // Tras el cierre: garantiza el <dialog> cerrado y limpia el contenido cuando acabó la animación.
  useEffect(() => {
    if (derivacion) return;
    const dialogEl = hostRef.current?.querySelector('dialog');
    if (dialogEl?.hasAttribute('open')) {
      if (typeof dialogEl.close === 'function') dialogEl.close();
      else dialogEl.removeAttribute('open');
    }
    const timer = window.setTimeout(
      () => {
        setDisplayed((prev) => (prev ? null : prev));
        setContentReady((prev) => (prev ? false : prev));
      },
      prefersReducedMotion() ? 0 : CLOSE_ANIMATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [derivacion]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  useEffect(() => {
    if (!isOpen) return;
    if (prefersReducedMotion()) {
      setContentReady(true);
      return;
    }
    let timerId = 0;
    const rafId = window.requestAnimationFrame(() => {
      timerId = window.setTimeout(() => startTransition(() => setContentReady(true)), DEFERRED_CONTENT_DELAY_MS);
    });
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [isOpen]);

  const finishClose = useCallback(() => {
    closingIdRef.current = null;
    // motion-kit 0.20.x también llama a onClose desde destroy() (StrictMode) y el diálogo se
    // reabre enseguida: si sigue abierto, no fue un cierre real.
    if (hostRef.current?.querySelector('dialog')?.open) return;
    startTransition(() => onClose());
  }, [onClose]);

  /** Tras un cierre del kit (X, Escape, fondo): espera la animación y luego avisa al padre. */
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen || !derivacion || closingIdRef.current === derivacion.id) return;
      closingIdRef.current = derivacion.id;
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(finishClose, prefersReducedMotion() ? 0 : CLOSE_ANIMATION_MS);
    },
    [derivacion, finishClose],
  );

  return (
    <div ref={hostRef}>
      <Dialog.Root
        key={generation}
        placement="side"
        variant="morph"
        animateContent={false}
        autoResize={false}
        drag={false}
        anchor={anchor}
        open={isOpen}
        onOpenChange={handleOpenChange}
      >
        <Dialog.Content className="vc-canalizacion-dialog">
          <CanalizacionTopBar derivacion={active} onOpenExpediente={onOpenExpediente} />
          <Dialog.Body>
            {active ? (
              <div className="grid gap-4">
                <CanalizacionHeroCard derivacion={active} />
                <CanalizacionSections derivacion={active} />
                {contentReady ? (
                  <CanalizacionDrawerActions
                    derivacion={active}
                    updatingId={updatingId}
                    onUpdateEstado={onUpdateEstado}
                  />
                ) : (
                  <div
                    role="status"
                    aria-busy="true"
                    aria-label="Cargando acciones"
                    className="h-[72px] rounded-2xl bg-surface-container animate-pulse motion-reduce:animate-none"
                  />
                )}
              </div>
            ) : null}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
});
