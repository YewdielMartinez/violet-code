import { useEffect, useState } from 'react';
import { useDialog } from '@yewdiel21/motion-kit/react';
import { isMorphing } from '@yewdiel21/motion-kit';

/** Tope por defecto por si el kit nunca informa que terminó el morph (p. ej. pestaña en segundo plano). */
const MAX_WAIT_MS = 1500;

/**
 * `true` cuando el `Dialog` que contiene al componente ya puede recibir montajes pesados.
 *
 * El morph de apertura del kit (0.7 s, no configurable en 0.20.4) anima `clip-path` sobre todo el diálogo y se
 * repinta en el hilo principal en cada frame: cualquier montaje caro de React (Selects, DateTimePicker, formularios)
 * que caiga dentro lo congela. En vez de diferir TODA la vista (esqueleto hasta el final del morph), cada vista
 * renderiza al instante lo liviano y usa este hook solo para la parte pesada.
 *
 * - Sin argumento: espera a que termine el morph (`isMorphing`), con tope de 1.5 s.
 * - `maxWaitMs`: monta a lo sumo a ese tiempo aunque el morph siga (la curva `signature` casi no se mueve en el
 *   último tercio, así que una sola tarea corta ahí no se nota). 420 ms ≈ 60 % del morph.
 *
 * Con `prefers-reduced-motion` el kit no anima (`isMorphing` es `false`) y resuelve en el siguiente frame.
 * Debe usarse dentro de `<Dialog.Content>`; cada montaje de vista espera como mucho un frame si el diálogo ya abrió.
 */
export function useDialogSettled(maxWaitMs: number = MAX_WAIT_MS): boolean {
  const { instance } = useDialog();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const startedAt = performance.now();
    let rafId = 0;

    const check = () => {
      const surface = instance.current?.element ?? null;
      const waiting = surface !== null && isMorphing(surface);
      if (waiting && performance.now() - startedAt < maxWaitMs) {
        rafId = window.requestAnimationFrame(check);
        return;
      }
      setSettled(true);
    };

    // Un frame de gracia: el kit arranca el morph en su layout effect y `isMorphing` ya es fiable en `check`.
    rafId = window.requestAnimationFrame(check);
    return () => window.cancelAnimationFrame(rafId);
  }, [instance, maxWaitMs]);

  return settled;
}
