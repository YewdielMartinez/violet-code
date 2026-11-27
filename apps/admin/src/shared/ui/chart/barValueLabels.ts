import { useEffect, type RefObject } from 'react';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Ancho aproximado de un carácter de 11px (cifras tabulares). */
const CHAR_WIDTH = 6.6;
/** Pausa tras el último cambio del SVG: el kit lo redibuja en cada cuadro mientras anima. */
const SETTLE_MS = 120;

/**
 * Decide si una etiqueta de valor cabe sobre su barra: solo si el texto no pasa del hueco entre barras vecinas
 * (`slot`, px entre centros). Función pura, probada aparte.
 */
export function labelFits(text: string, slot: number): boolean {
  return text.length * CHAR_WIDTH + 6 <= slot;
}

/** Quita las etiquetas ya puestas (el kit redibuja todo el SVG, pero esto cubre el caso de volver a llamar). */
function clearLabels(svg: SVGSVGElement): void {
  svg.querySelectorAll('[data-vc-bar-label]').forEach((node) => node.remove());
}

/**
 * Pone el valor sobre cada barra de una gráfica del kit de UNA serie (las apiladas ya traen su total). Lee la caja de
 * cada `<path data-mk-part="bar">` ya dibujada, así que no depende de la geometría interna del kit. Si las etiquetas no
 * caben (muchas barras angostas) no se pone ninguna: el valor sigue saliendo en el tooltip y en «Ver datos».
 */
export function applyBarValueLabels(svg: SVGSVGElement, values: readonly number[], format: (value: number) => string): number {
  clearLabels(svg);
  const bars = Array.from(svg.querySelectorAll<SVGPathElement>('path[data-mk-part="bar"]'));
  if (bars.length === 0 || typeof bars[0].getBBox !== 'function') return 0;

  const boxes = bars.map((bar) => ({ bar, box: bar.getBBox() }));
  const centers = boxes.map(({ box }) => box.x + box.width / 2).sort((a, b) => a - b);
  const slot = centers.length > 1 ? Math.min(...centers.slice(1).map((c, i) => c - centers[i])) : Infinity;

  const texts = boxes.map(({ bar }) => {
    const index = Number(bar.getAttribute('data-mk-index'));
    const value = values[index];
    return typeof value === 'number' ? format(value) : '';
  });
  if (texts.some((text, i) => text && !labelFits(text, slot) && boxes[i].box.height > 0)) return 0;

  const layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('data-vc-bar-label', '');
  layer.setAttribute('data-mk-part', 'bar-label-layer');
  layer.setAttribute('aria-hidden', 'true');
  boxes.forEach(({ box }, i) => {
    if (!texts[i]) return;
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('data-mk-part', 'bar-label');
    text.setAttribute('x', String(Math.round((box.x + box.width / 2) * 100) / 100));
    text.setAttribute('y', String(Math.round((box.y - 6) * 100) / 100));
    text.setAttribute('text-anchor', 'middle');
    text.textContent = texts[i];
    layer.append(text);
  });
  svg.append(layer);
  return layer.childNodes.length;
}

/**
 * Etiquetas de valor sobre las barras, puestas cuando la gráfica termina de dibujarse (y de nuevo tras cada redibujo
 * o cambio de tamaño). `enabled` en `false` (líneas, áreas, apiladas) no hace nada.
 */
export function useBarValueLabels(
  container: RefObject<HTMLElement | null>,
  values: readonly number[],
  format: (value: number) => string,
  enabled = true,
): void {
  useEffect(() => {
    const root = container.current;
    if (!enabled || !root || typeof MutationObserver === 'undefined') return;
    const svg = root.querySelector<SVGSVGElement>('[data-mk-chart-svg]');
    if (!svg) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => schedule());
    const watch = () => observer.observe(svg, { childList: true });
    const run = () => {
      observer.disconnect();
      try {
        applyBarValueLabels(svg, values, format);
      } finally {
        watch();
      }
    };
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(run, SETTLE_MS);
    }

    watch();
    schedule();
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [container, values, format, enabled]);
}
