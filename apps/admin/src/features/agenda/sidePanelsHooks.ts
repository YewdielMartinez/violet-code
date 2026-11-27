import { useEffect, useRef, useState } from 'react';

/** `true` si el usuario pidió reducir el movimiento. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const HIGHLIGHT_MS = 2600;

/**
 * Devuelve los ids que aparecieron después de la primera carga (para resaltarlos un momento).
 * La primera lista cargada no se resalta.
 */
export function useNewIds(ids: readonly string[], ready: boolean): ReadonlySet<string> {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const signature = ids.join('|');

  useEffect(() => {
    if (!ready) return;
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const known = seen.current;
    const added = ids.filter((id) => !known.has(id));
    for (const id of ids) known.add(id);
    if (added.length === 0) {
      setFresh((prev) => (prev.size ? new Set() : prev));
      return;
    }
    setFresh(new Set(added));
    const timer = window.setTimeout(() => setFresh(new Set()), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` resume `ids`.
  }, [signature, ready]);

  return fresh;
}
