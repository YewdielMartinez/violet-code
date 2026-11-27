/**
 * Decorado de celdas DESPUÉS de que el kit dibuja las filas (`DataTable.onRender`). El kit escribe texto plano en cada
 * celda, así que las cápsulas de estado, los énfasis y los `title` de texto truncado se aplican aquí. Todo es
 * idempotente por celda: si el kit reescribe una celda (búsqueda con `<mark>`, orden, `updateRow`), `onRender` vuelve a
 * correr y se decora otra vez. NO se marca la fila como «ya decorada»: eso dejaba sin cápsula a las celdas reescritas.
 */

export type PillTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

export interface PillColumnSpec {
  /** Texto de la celda → tono. Lo que no esté aquí usa `fallback` (neutral). */
  tones: Readonly<Record<string, PillTone>>;
  /** Parte la celda por « · » y dibuja una cápsula por fragmento («Pendiente · Vencida»). */
  split?: boolean;
  fallback?: PillTone;
}

export interface RowDecorSpec {
  /** Columnas (`key`) que se muestran como cápsula de estado. */
  pills?: Readonly<Record<string, PillColumnSpec>>;
  /** Columnas principales: peso 600 y color de texto pleno (nombre, folio, título…). */
  strong?: readonly string[];
  /** Identificadores: monoespaciada. */
  mono?: readonly string[];
  /** Datos secundarios: color atenuado. */
  muted?: readonly string[];
  /** Columnas que se truncan con «…»; el texto completo queda en `title`. */
  truncate?: readonly string[];
  /** Filas clicables: enfocables con Tab (el CSS pone cursor, hover y anillo de foco). */
  interactive?: boolean;
}

export const PILL_SEPARATOR = ' · ';

/** Cápsula `vc-dt-pill`: punto de color (o ícono) + texto; el significado no depende solo del color. */
export function pillElement(label: string, tone: PillTone, icon?: string): HTMLSpanElement {
  const pill = document.createElement('span');
  pill.className = `vc-dt-pill vc-dt-pill--${tone}`;

  const mark = document.createElement('span');
  if (icon) {
    mark.className = 'mk-icon vc-dt-pill__icon';
    mark.textContent = icon;
  } else {
    mark.className = 'vc-dt-pill__dot';
  }
  mark.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = label;

  pill.append(mark, text);
  return pill;
}

/** Reemplaza el texto de la celda por cápsula(s). No hace nada si ya la tiene o si la celda está vacía. */
export function decoratePillCell(td: HTMLTableCellElement | null | undefined, spec: PillColumnSpec): void {
  if (!td || td.querySelector('.vc-dt-pill')) return;
  const text = (td.textContent ?? '').trim();
  if (!text) return;
  const fallback = spec.fallback ?? 'neutral';
  const labels = spec.split ? text.split(PILL_SEPARATOR) : [text];
  if (labels.length === 1) {
    td.replaceChildren(pillElement(labels[0], spec.tones[labels[0]] ?? fallback));
    return;
  }
  const wrap = document.createElement('span');
  wrap.className = 'vc-pills';
  for (const label of labels) wrap.append(pillElement(label, spec.tones[label] ?? fallback));
  td.replaceChildren(wrap);
}

const asSet = (keys: readonly string[] | undefined) => new Set(keys ?? []);

/**
 * Devuelve el `onRender` para un `DataTable`. La especificación se resuelve una sola vez (no por fila); la función
 * devuelta recorre solo las filas con `data-id` que no son esqueleto.
 */
export function createRowDecorator(spec: RowDecorSpec): (tbody: HTMLTableSectionElement) => void {
  const pills = new Map(Object.entries(spec.pills ?? {}));
  const strong = asSet(spec.strong);
  const mono = asSet(spec.mono);
  const muted = asSet(spec.muted);
  const truncate = asSet(spec.truncate);
  const interactive = Boolean(spec.interactive);

  return (tbody) => {
    for (const tr of tbody.rows) {
      if (!tr.dataset.id || tr.hasAttribute('data-mk-dt-loading')) continue;
      if (interactive && tr.tabIndex < 0) tr.tabIndex = 0;
      for (const td of tr.cells) {
        const key = td.dataset.key;
        if (!key) continue;
        // El `title` se toma antes de que la celda se convierta en cápsula.
        if (truncate.has(key)) {
          td.classList.add('vc-table__trunc');
          const full = (td.textContent ?? '').trim();
          if (full && td.title !== full) td.title = full;
        }
        if (strong.has(key)) td.classList.add('vc-table__strong');
        if (mono.has(key)) td.classList.add('vc-table__mono');
        if (muted.has(key)) td.classList.add('vc-table__muted');
        const pill = pills.get(key);
        if (pill) decoratePillCell(td, pill);
      }
      // Solo informativo (depuración / pruebas): NO se usa para saltar la fila, ver el comentario del archivo.
      tr.dataset.vcDecorated = '1';
    }
  };
}
