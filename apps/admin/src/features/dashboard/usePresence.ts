import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './flip';

export type PresenceState = 'pre' | 'in' | 'out';

/**
 * Mantiene montado un elemento mientras dura su animación de salida y da el estado que pinta el CSS:
 * `pre` (recién montado, punto de partida), `in` (visible) y `out` (saliendo). Las transiciones CSS
 * (no animaciones) hacen el resto: si React mueve el nodo de lugar no se repiten.
 * Con «reducir movimiento» entra y sale de inmediato.
 */
export function usePresence(active: boolean, exitMs: number): { mounted: boolean; state: PresenceState } {
  const [seen, setSeen] = useState(active);
  const [lingering, setLingering] = useState(false);
  const [entered, setEntered] = useState(active);

  // Reacción al cambio de `active` durante el render (sin efectos que disparen renders en cascada).
  if (active !== seen) {
    setSeen(active);
    const instant = prefersReducedMotion();
    setLingering(!active && !instant);
    setEntered(active && instant);
  }

  useEffect(() => {
    if (!active || entered) return;
    // Dos cuadros: el primero pinta `pre`, el segundo pasa a `in` y la transición corre.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [active, entered]);

  useEffect(() => {
    if (!lingering) return;
    const timer = setTimeout(() => setLingering(false), exitMs);
    return () => clearTimeout(timer);
  }, [lingering, exitMs]);

  return { mounted: active || lingering, state: !active ? 'out' : entered ? 'in' : 'pre' };
}
