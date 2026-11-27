import { useEffect, useState, type RefObject } from 'react';

type IdleHandle = { cancel: () => void };

/** Ejecuta `cb` cuando el hilo principal está libre (o tras `timeout` ms como máximo). */
export function whenIdle(cb: () => void, timeout = 800): IdleHandle {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(cb, { timeout });
    return { cancel: () => cancelIdleCallback(id) };
  }
  const id = setTimeout(cb, 1);
  return { cancel: () => clearTimeout(id) };
}

/**
 * `true` cuando el elemento ya entró en el viewport y el navegador quedó libre. Sirve para no montar
 * componentes pesados (gráficas, calendarios con animación de entrada) en la primera pintura: antes se
 * muestra un esqueleto. Es un latch: una vez `true` no vuelve a `false`.
 * Sin IntersectionObserver (jsdom, navegadores viejos) es `true` desde el inicio.
 */
export function useWhenVisible(ref: RefObject<Element | null>): boolean {
  const [ready, setReady] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (ready) return;
    const el = ref.current;
    if (!el) return;
    let idle: IdleHandle | null = null;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || idle) return;
      observer.disconnect();
      idle = whenIdle(() => setReady(true));
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      idle?.cancel();
    };
  }, [ready, ref]);

  return ready;
}
