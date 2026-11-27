import { describe, expect, it } from 'vitest';
import { applyBarValueLabels, labelFits } from '@/shared/ui/chart/barValueLabels';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG con barras de `getBBox` fijo (jsdom no calcula geometría). */
function chart(bars: { index: number; x: number; y: number; width: number; height: number }[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  for (const bar of bars) {
    const path = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
    path.setAttribute('data-mk-part', 'bar');
    path.setAttribute('data-mk-index', String(bar.index));
    path.getBBox = () =>
      ({
        x: bar.x,
        y: bar.y,
        width: bar.width,
        height: bar.height,
        top: bar.y,
        left: bar.x,
        right: bar.x + bar.width,
        bottom: bar.y + bar.height,
        toJSON: () => ({}),
      }) as DOMRect;
    svg.append(path);
  }
  return svg;
}

describe('labelFits', () => {
  it('cabe si el texto no pasa del hueco entre barras', () => {
    expect(labelFits('12', 60)).toBe(true);
    expect(labelFits('1,248', 30)).toBe(false);
  });
});

describe('applyBarValueLabels', () => {
  const fmt = (n: number) => n.toLocaleString('es-MX');

  it('pone el valor centrado sobre cada barra', () => {
    const svg = chart([
      { index: 0, x: 10, y: 80, width: 20, height: 40 },
      { index: 1, x: 90, y: 40, width: 20, height: 80 },
    ]);
    expect(applyBarValueLabels(svg, [5, 12_000], fmt)).toBe(2);
    const labels = Array.from(svg.querySelectorAll('[data-mk-part="bar-label"]'));
    expect(labels.map((l) => l.textContent)).toEqual(['5', '12,000']);
    expect(labels[0].getAttribute('x')).toBe('20');
    expect(labels[0].getAttribute('y')).toBe('74');
    expect(svg.querySelector('[data-vc-bar-label]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('no pone ninguna si no caben (barras muy juntas) y es idempotente', () => {
    const svg = chart([
      { index: 0, x: 10, y: 80, width: 8, height: 40 },
      { index: 1, x: 22, y: 60, width: 8, height: 60 },
    ]);
    expect(applyBarValueLabels(svg, [1500, 2500], fmt)).toBe(0);
    expect(svg.querySelectorAll('[data-mk-part="bar-label"]')).toHaveLength(0);

    const ancha = chart([{ index: 0, x: 10, y: 80, width: 20, height: 40 }]);
    applyBarValueLabels(ancha, [3], fmt);
    applyBarValueLabels(ancha, [3], fmt);
    expect(ancha.querySelectorAll('[data-mk-part="bar-label"]')).toHaveLength(1);
  });

  it('sin barras no hace nada', () => {
    expect(applyBarValueLabels(chart([]), [], fmt)).toBe(0);
  });
});
