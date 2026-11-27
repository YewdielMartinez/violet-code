import type { PrintBar, PrintChart, PrintLegendItem } from './types';

/** Propiedades visuales que viven en CSS (clases del kit y variables del tema) y hay que fijar en el SVG clonado. */
const COPY_PROPS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'font-size',
  'font-family',
  'font-weight',
  'text-anchor',
] as const;

/** Partes del SVG del kit que solo tienen sentido en pantalla (interacción) y se quitan del PDF. */
const STRIP_PARTS = new Set(['bar-value', 'guide', 'band', 'tooltip', 'hit', 'hover']);

const TEXT_COLOR = '#333333';
const GRID_COLOR = '#e6d5d9';
const TRACK_COLOR = '#fbf7f7';
const SURFACE = '#ffffff';

/** Lee `rgb()/rgba()` o `color(srgb r g b / a)` (lo que devuelve `getComputedStyle`) como canales 0-255 y alfa. */
function parseColor(value: string): { r: number; g: number; b: number; a: number } | null {
  const rgb = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.%]+))?\s*\)$/.exec(value.trim());
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] === undefined ? 1 : alpha(rgb[4]) };
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.%]+))?\s*\)$/.exec(value.trim());
  if (srgb) {
    return { r: +srgb[1] * 255, g: +srgb[2] * 255, b: +srgb[3] * 255, a: srgb[4] === undefined ? 1 : alpha(srgb[4]) };
  }
  return null;
}

function alpha(raw: string): number {
  return raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
}

function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Los colores del tema oscuro son claros: sobre papel blanco se pierden. Si el color no llega a 3:1 contra blanco se
 * oscurece (mismo tono) hasta que sí. Los colores que ya contrastan, o que no se pueden leer, se devuelven tal cual.
 */
export function legible(color: string): string {
  const parsed = parseColor(color);
  if (!parsed || parsed.a < 0.5) return color;
  let { r, g, b } = parsed;
  for (let i = 0; i < 12 && 1.05 / (luminance({ r, g, b }) + 0.05) < 3; i++) {
    r *= 0.85;
    g *= 0.85;
    b *= 0.85;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

const FREE_COLOR_PARTS = new Set(['grid', 'bar-track', 'dot', 'marker', 'end']);

function overridesFor(tag: string, part: string | null): Record<string, string> {
  if (tag === 'text') return { fill: TEXT_COLOR, stroke: 'none' };
  if (part === 'grid') return { stroke: GRID_COLOR };
  if (part === 'bar-track') return { fill: TRACK_COLOR };
  if (part === 'dot' || part === 'marker' || part === 'end') return { stroke: SURFACE };
  return {};
}

/**
 * Clona un SVG del kit para el PDF: copia los estilos calculados (el CSS de la aplicación no existe en el documento
 * impreso), fuerza texto y rejilla en tonos claros-sobre-blanco aunque el tema sea oscuro y quita lo interactivo.
 * Devuelve el SVG como texto o `null` si no hay nada que serializar.
 */
export function serializeSvg(svg: Element | null | undefined): string | null {
  if (!svg || svg.tagName.toLowerCase() !== 'svg') return null;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const sources = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const targets = [clone, ...Array.from(clone.querySelectorAll('*'))];
  const remove: Element[] = [];

  sources.forEach((source, i) => {
    const target = targets[i];
    if (!target) return;
    const part = source.getAttribute('data-mk-part');
    const tag = source.tagName.toLowerCase();
    const computed = typeof getComputedStyle === 'function' ? getComputedStyle(source) : null;
    if ((part && STRIP_PARTS.has(part)) || (i > 0 && computed?.display === 'none') || source.hasAttribute('hidden')) {
      if (i > 0) remove.push(target);
      return;
    }
    const style = (target as SVGElement).style;
    if (computed) {
      for (const prop of COPY_PROPS) {
        const value = computed.getPropertyValue(prop);
        if (!value) continue;
        const esColor = (prop === 'fill' || prop === 'stroke') && tag !== 'text' && !(part && FREE_COLOR_PARTS.has(part));
        style.setProperty(prop, esColor ? legible(value) : value);
      }
    }
    for (const [prop, value] of Object.entries(overridesFor(tag, part))) style.setProperty(prop, value);
    target.removeAttribute('class');
    target.removeAttribute('tabindex');
  });
  for (const node of remove) node.remove();

  clone.removeAttribute('style');
  clone.removeAttribute('width');
  clone.removeAttribute('height');
  clone.removeAttribute('role');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('aria-hidden', 'true');
  if (!clone.getAttribute('viewBox')) {
    const box = (svg as SVGSVGElement).getBoundingClientRect?.();
    if (box && box.width > 0 && box.height > 0) clone.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  }
  return new XMLSerializer().serializeToString(clone);
}

/** Leyenda HTML del kit (`[data-mk-chart-legend] li`) como pares etiqueta / color. */
function legendFrom(container: Element): PrintLegendItem[] {
  const items: PrintLegendItem[] = [];
  container.querySelectorAll('[data-mk-chart-legend] li').forEach((li) => {
    const label = li.textContent?.trim();
    if (!label) return;
    const swatch = li.querySelector('[data-mk-chart-swatch]');
    const computed = swatch && typeof getComputedStyle === 'function' ? getComputedStyle(swatch) : null;
    const color =
      computed?.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)'
        ? computed.backgroundColor
        : (computed?.borderTopColor ?? '#5b2a86');
    items.push({ label, color: legible(color) });
  });
  return items;
}

/**
 * Captura la gráfica visible dentro de `container`: su SVG (con leyenda) o, si la gráfica no está dibujada
 * (alternancia «Ver datos» o barras HTML), las barras de respaldo con los mismos datos. `null` si no hay ninguna.
 */
export function chartFromContainer(
  container: Element | null | undefined,
  title: string,
  fallbackBars?: readonly PrintBar[],
): PrintChart | null {
  const found = container?.querySelector('[data-mk-chart-svg]') ?? container?.querySelector('svg');
  const svgEl = found?.tagName.toLowerCase() === 'svg' ? found : (found?.querySelector('svg') ?? null);
  const svg = serializeSvg(svgEl);
  if (svg && container) {
    const legend = legendFrom(container);
    return { title, svg, ...(legend.length > 0 ? { legend } : {}) };
  }
  if (fallbackBars && fallbackBars.length > 0) return { title, bars: fallbackBars };
  return null;
}

/** Busca un panel de gráfica (`section.est-panel[aria-label]`) por su título dentro de `root`. */
export function panelPorTitulo(root: ParentNode | null | undefined, title: string): Element | null {
  if (!root) return null;
  for (const panel of Array.from(root.querySelectorAll('section[aria-label]'))) {
    if (panel.getAttribute('aria-label') === title) return panel;
  }
  return null;
}
