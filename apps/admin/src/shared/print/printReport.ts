import { APP_NAME } from '@/app/brand';
import type { ExportCell } from '@/shared/export';
import { PRINT_CSS, PRINT_ROOT_ID } from './printCss';
import type { PrintBar, PrintChart, PrintReportOptions } from './types';

export const INSTITUCION = 'Secretaría de las Mujeres · Ahome';
export const TIMEZONE = 'America/Mazatlan';
export const NOTA_SIN_DATOS_PERSONALES = 'Documento sin datos personales';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Logotipos del encabezado y del pie (los mismos de `BrandMark` y `AhomeLogo`). */
export const LOGO_APP = '/logos/app-icon.svg';
export const LOGO_AHOME = '/logo-ahome.png';
/** Proporción del logotipo de Ahome (`public/logo-ahome.png`: 1260 × 408 px). */
const AHOME_ASPECT = 1260 / 408;
/** Máximo que se espera a las imágenes antes de imprimir de todos modos. */
const IMAGE_TIMEOUT_MS = 3000;

/** URL absoluta de un recurso de `public/`: el documento de impresión no depende de la ruta actual. */
export function urlAbsoluta(path: string): string {
  return new URL(path, window.location.origin).href;
}

/** Pide los logotipos con antelación para que estén en caché cuando se imprima (p. ej. con `Ctrl/Cmd+P`). */
export function precargarLogos(): void {
  for (const path of [LOGO_APP, LOGO_AHOME]) {
    const img = new Image();
    img.src = urlAbsoluta(path);
  }
}

/** Espera a que carguen las imágenes de `root` (o el tope de tiempo) para que salgan en el PDF. */
export async function esperarImagenes(root: ParentNode, timeoutMs = IMAGE_TIMEOUT_MS): Promise<void> {
  const pendientes = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete);
  if (pendientes.length === 0) return;
  const cargas = pendientes.map(
    (img) =>
      new Promise<void>((resolve) => {
        const fin = () => resolve();
        img.addEventListener('load', fin, { once: true });
        img.addEventListener('error', fin, { once: true });
      }),
  );
  await Promise.race([
    Promise.all(cargas),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

/** «27 de noviembre de 2026, 14:05» en la zona horaria de Ahome. */
export function fechaGeneracion(now: Date): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short', timeZone: TIMEZONE }).format(now);
}

function formatCell(value: ExportCell): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'number' ? value.toLocaleString('es-MX') : value;
}

function imagen(path: string, className: string, alt = ''): HTMLImageElement {
  const img = document.createElement('img');
  img.src = urlAbsoluta(path);
  img.alt = alt;
  if (!alt) img.setAttribute('aria-hidden', 'true');
  img.className = className;
  img.decoding = 'sync';
  img.draggable = false;
  return img;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Convierte el SVG serializado en un nodo seguro: solo se acepta un `<svg>`; se descartan scripts, `foreignObject`,
 * manejadores `on*` y enlaces `javascript:`.
 */
export function parseSvg(markup: string): SVGElement | null {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) return null;
  for (const node of Array.from(root.querySelectorAll('script, foreignObject, iframe, object, embed'))) node.remove();
  for (const node of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'xlink:href') && /^\s*javascript:/i.test(attr.value))) {
        node.removeAttribute(attr.name);
      }
    }
  }
  const imported = document.importNode(root, true) as unknown as SVGElement;
  return imported.namespaceURI === SVG_NS ? imported : null;
}

function barsNode(bars: readonly PrintBar[]): HTMLElement {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const list = el('ul', 'vcp-bars');
  for (const bar of bars) {
    const li = el('li');
    li.append(el('span', 'vcp-bars__label', bar.label));
    const track = el('span', 'vcp-bars__track');
    const fill = el('span', 'vcp-bars__fill');
    fill.style.width = `${Math.max(2, (bar.value / max) * 100)}%`;
    track.append(fill);
    li.append(track, el('span', 'vcp-bars__value', bar.value.toLocaleString('es-MX')));
    list.append(li);
  }
  return list;
}

function chartNode(chart: PrintChart, full: boolean): HTMLElement | null {
  const figure = el('figure', full ? 'vcp-chart vcp-chart--full' : 'vcp-chart');
  figure.append(el('figcaption', undefined, chart.title));
  const svg = chart.svg ? parseSvg(chart.svg) : null;
  if (svg) {
    figure.append(svg);
    if (chart.legend && chart.legend.length > 0) {
      const legend = el('ul', 'vcp-legend');
      for (const item of chart.legend) {
        const li = el('li');
        const swatch = el('span', 'vcp-swatch');
        swatch.style.background = item.color;
        li.append(swatch, document.createTextNode(item.label));
        legend.append(li);
      }
      figure.append(legend);
    }
  } else if (chart.bars && chart.bars.length > 0) {
    figure.append(barsNode(chart.bars));
  } else {
    return null;
  }
  return figure;
}

function isNumericColumn<T>(rows: readonly T[], value: (row: T) => ExportCell): boolean {
  let any = false;
  for (const row of rows) {
    const v = value(row);
    if (v === null || v === undefined || v === '') continue;
    if (typeof v !== 'number') return false;
    any = true;
  }
  return any;
}

/**
 * Arma el documento imprimible como DOM (todo el texto entra por `textContent`, sin HTML interpolado). Es el contenido
 * de `#vc-print-root`: encabezado institucional, filtros, indicadores, gráficas, tabla y pie.
 */
export function buildPrintRoot<T>(options: PrintReportOptions<T>): HTMLElement {
  const { title, subtitle, filtros, kpis, columns, rows, usuarioRol, isTotal, monoKeys } = options;
  const nota = options.nota;
  const now = options.now ?? new Date();

  const root = el('div');
  root.id = PRINT_ROOT_ID;
  root.setAttribute('aria-hidden', 'true');
  root.append(el('style', undefined, PRINT_CSS));

  const generado = fechaGeneracion(now);

  const footer = el('footer', 'vcp-footer');
  const footerBrand = el('div', 'vcp-footer__brand');
  footerBrand.append(imagen(LOGO_APP, 'vcp-footer__mark'));
  const footerText = el('div', 'vcp-footer__text');
  const footerLine = el('span');
  footerLine.append(el('strong', undefined, APP_NAME), document.createTextNode(` · ${INSTITUCION}`));
  footerText.append(footerLine);
  if (nota) footerText.append(el('span', undefined, nota));
  footerBrand.append(footerText);
  footer.append(footerBrand, el('span', 'vcp-footer__when', `Generado: ${generado}`));
  root.append(footer);

  const doc = el('article', 'vcp-doc');

  const head = el('header', 'vcp-head');
  const brandLine = el('div', 'vcp-brandline');
  const brandText = el('div');
  brandText.append(el('p', 'vcp-brand', APP_NAME), el('p', 'vcp-inst', INSTITUCION));
  brandLine.append(imagen(LOGO_APP, 'vcp-logo-app'), brandText);
  const ahome = imagen(LOGO_AHOME, 'vcp-logo-ahome', 'Municipio de Ahome');
  ahome.width = Math.round(40 * AHOME_ASPECT);
  ahome.height = 40;
  head.append(brandLine, ahome);
  doc.append(head);

  const titles = el('div', 'vcp-titles');
  titles.append(el('h1', 'vcp-title', title));
  if (subtitle) titles.append(el('p', 'vcp-sub', subtitle));
  doc.append(titles);

  const meta = el('dl', 'vcp-meta');
  const entries = [
    ...filtros.map((f) => [f.label, f.value] as const),
    ['Generado', generado] as const,
    ...(usuarioRol ? ([['Usuario (rol)', usuarioRol]] as const) : []),
  ];
  for (const [label, value] of entries) {
    const row = el('div');
    row.append(el('dt', undefined, `${label}:`), el('dd', undefined, value));
    meta.append(row);
  }
  doc.append(meta);

  if (kpis && kpis.length > 0) {
    const list = el('dl', 'vcp-kpis');
    for (const kpi of kpis) {
      const item = el('div', 'vcp-kpi');
      item.append(
        el('dt', undefined, kpi.label),
        el('dd', undefined, typeof kpi.value === 'number' ? kpi.value.toLocaleString('es-MX') : kpi.value),
      );
      if (kpi.nota) item.append(el('p', undefined, kpi.nota));
      list.append(item);
    }
    doc.append(list);
  }

  const charts: PrintChart[] = [
    ...(options.chartSvg ? [{ title, svg: options.chartSvg }] : []),
    ...(options.charts ?? []),
  ];
  const nodes = charts.map((chart, i) => chartNode(chart, charts.length === 1 || (i === 0 && charts.length % 2 === 1)));
  const drawn = nodes.filter((n): n is HTMLElement => n !== null);
  if (drawn.length > 0) {
    const grid = el('section', 'vcp-charts');
    grid.setAttribute('aria-label', 'Gráficas');
    grid.append(...drawn);
    doc.append(grid);
  }

  const numeric = columns.map((c) => isNumericColumn(rows, c.value));
  const table = el('table', 'vcp-table');
  table.append(el('caption', undefined, `${title}${subtitle ? ` · ${subtitle}` : ''}`));
  const thead = el('thead');
  const headRow = el('tr');
  columns.forEach((c, i) => {
    const th = el('th', numeric[i] ? 'vcp-num' : undefined, c.header);
    th.scope = 'col';
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = el('tbody');
  for (const row of rows) {
    const tr = el('tr', isTotal?.(row) ? 'vcp-total' : undefined);
    columns.forEach((c, i) => {
      const clase = numeric[i] ? 'vcp-num' : monoKeys?.includes(c.key) ? 'vcp-mono' : undefined;
      tr.append(el('td', clase, formatCell(c.value(row))));
    });
    tbody.append(tr);
  }
  table.append(thead, tbody);
  doc.append(table);

  root.append(doc);
  return root;
}

/** Quita el documento de impresión que haya en la página. */
export function unmountPrintRoot(): void {
  document.querySelectorAll(`#${PRINT_ROOT_ID}`).forEach((node) => node.remove());
}

export function isPrintRootMounted(): boolean {
  return document.getElementById(PRINT_ROOT_ID) !== null;
}

/** Monta el documento en `<body>` y devuelve la función que lo retira. */
export function mountPrintRoot<T>(options: PrintReportOptions<T>): () => void {
  unmountPrintRoot();
  const root = buildPrintRoot(options);
  document.body.append(root);
  return () => root.remove();
}

/**
 * Imprime el reporte: monta el documento (solo visible al imprimir), espera a que carguen los logotipos, abre el diálogo
 * del navegador —donde la persona elige «Guardar como PDF»— y lo retira al terminar (`afterprint`). Resuelve `false` si
 * no hay filas que imprimir.
 */
export async function printReport<T>(options: PrintReportOptions<T>): Promise<boolean> {
  if (options.rows.length === 0) return false;
  const unmount = mountPrintRoot(options);
  const root = document.getElementById(PRINT_ROOT_ID);
  const cleanup = () => {
    unmount();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  try {
    if (root) await esperarImagenes(root);
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  }
  return true;
}
