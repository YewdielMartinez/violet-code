import { useEffect, useState, type ReactNode } from 'react';
import { Dialog, useDialog } from '@yewdiel21/motion-kit/react';
import { isMorphing } from '@yewdiel21/motion-kit';
import '@yewdiel21/motion-kit/css/components/dialog';

/** Tope de espera por si el kit nunca informa que terminó el morph (p. ej. pestaña en segundo plano). */
const MAX_WAIT_MS = 1500;

/** Mismos campos que enfoca el kit al abrir (`FIELDS` en su engine de dialog). */
const FIELDS =
  '[autofocus], input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled)';

interface DeferredDialogContentProps {
  /** `true` desde que se abre el diálogo hasta que termina de cerrarse (el contenido sigue montado al cerrar). */
  active: boolean;
  /** Se muestra mientras el diálogo se anima; debe ser barato y ocupar un alto parecido al real. */
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * Monta el contenido pesado de un `Dialog` de motion-kit hasta que termina la animación de apertura.
 *
 * El morph del kit anima `clip-path` sobre todo el diálogo (se repinta en cada frame en el hilo principal)
 * y mide la caja una sola vez al arrancar. Si un formulario con Selects, switches y scroll areas se monta
 * en ese momento (o a mitad de la animación), la vuelta de React + los `create*` imperativos del kit caen
 * en medio del morph y se pierden frames; además el diálogo cambia de alto con el clip ya calculado.
 * Aquí el morph corre solo con un `fallback` liviano y el formulario se monta justo después.
 *
 * Debe renderizarse dentro de `<Dialog.Content>`.
 */
export function DeferredDialogContent({ active, fallback, children }: DeferredDialogContentProps) {
  const { instance } = useDialog();
  const [settled, setSettled] = useState(false);
  const [wasActive, setWasActive] = useState(active);

  // Al terminar de cerrar, el próximo ciclo vuelve a empezar con el marcador (ajuste durante el render, sin efecto).
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setSettled(false);
  }

  useEffect(() => {
    if (!active) return;

    const startedAt = performance.now();
    let rafId = 0;

    const check = () => {
      const surface = instance.current?.element ?? null;
      const waiting = surface !== null && isMorphing(surface);
      if (waiting && performance.now() - startedAt < MAX_WAIT_MS) {
        rafId = window.requestAnimationFrame(check);
        return;
      }
      setSettled(true);
    };

    // Un frame de gracia: el kit arranca el morph en su layout effect y `isMorphing` ya es fiable en `check`.
    rafId = window.requestAnimationFrame(check);
    return () => window.cancelAnimationFrame(rafId);
  }, [active, instance]);

  const showContent = active && settled;

  // El kit enfoca el primer campo al abrir, pero con el contenido diferido todavía no existe:
  // lo hacemos al montarlo, solo si la persona no ha movido el foco a otra parte.
  useEffect(() => {
    if (!showContent) return;
    const surface = instance.current?.element;
    if (!surface) return;
    const current = document.activeElement;
    const idle =
      !current ||
      current === document.body ||
      current === surface ||
      Boolean(current.closest('[data-mk-part="close"]'));
    if (!idle) return;
    surface.querySelector<HTMLElement>(FIELDS)?.focus({ preventScroll: true });
  }, [showContent, instance]);

  return <>{showContent ? children : active ? fallback : null}</>;
}

interface DialogFormSkeletonProps {
  /** Alturas (en rem) de los bloques de marcador; la suma debe parecerse al formulario real. */
  blocks: readonly number[];
  label?: string;
}

/** Marcador de posición del cuerpo y pie de un formulario en `Dialog`, sin componentes del kit ni efectos. */
export function DialogFormSkeleton({ blocks, label = 'Cargando formulario' }: DialogFormSkeletonProps) {
  return (
    <>
      <Dialog.Body>
        <div role="status" aria-busy="true" aria-label={label} className="grid gap-4 py-2">
          {blocks.map((height, index) => (
            <div
              key={index}
              style={{ height: `${height}rem` }}
              className="rounded-2xl bg-surface-container-low"
            />
          ))}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <div aria-hidden className="h-10 w-24 rounded-full bg-surface-container-low" />
        <div aria-hidden className="h-10 w-48 rounded-full bg-surface-container-low" />
      </Dialog.Footer>
    </>
  );
}
