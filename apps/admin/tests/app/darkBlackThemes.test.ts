import { describe, expect, it } from 'vitest';

import salmverseCss from '../../src/app/themes/salmverse.css?raw';
import darkBlackCss from '../../src/app/themes/dark-black.css?raw';
import blueCss from '../../../../node_modules/@yewdiel21/motion-kit/dist/css/themes/blue.css?raw';
import pinkCss from '../../../../node_modules/@yewdiel21/motion-kit/dist/css/themes/pink.css?raw';
import redCss from '../../../../node_modules/@yewdiel21/motion-kit/dist/css/themes/red.css?raw';
import blackCss from '../../../../node_modules/@yewdiel21/motion-kit/dist/css/themes/black.css?raw';
import oledCss from '../../../../node_modules/@yewdiel21/motion-kit/dist/css/themes/oled.css?raw';

const KIT_CSS: Record<string, string> = { blue: blueCss, pink: pinkCss, red: redCss, black: blackCss, oled: oledCss };
const kitOf = (theme: string) => KIT_CSS[theme];

function roles(block: string) {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--md-sys-color-([a-z-]+):\s*(#[0-9a-f]{6});/gi)) out[m[1]] = m[2].toLowerCase();
  return out;
}
const lum = (h: string) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const cr = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Paleta oscura efectiva: kit (o salmverse) + sobrescritura dark-black.css. */
function darkPalette(theme: string) {
  if (theme === 'salmverse') {
    const css = salmverseCss;
    const start = css.indexOf('[data-mk-theme="salmverse"][data-mk-mode="dark"]');
    return roles(css.slice(start, css.indexOf('}', start)));
  }
  const kit = kitOf(theme);
  const ks = kit.indexOf('[data-mk-mode="dark"] [data-mk-theme');
  const base = roles(kit.slice(ks, kit.indexOf('}', ks)));
  const over = darkBlackCss;
  const os = over.indexOf(`[data-mk-mode="dark"] [data-mk-theme="${theme}"]`);
  return { ...base, ...(os >= 0 ? roles(over.slice(os, over.indexOf('}', os))) : {}) };
}

describe.each(['salmverse', 'blue', 'pink', 'red', 'black', 'oled'])('modo oscuro de %s', (theme) => {
  const p = darkPalette(theme);
  const containers = ['surface', 'surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest'];

  it('tiene fondo negro puro', () => {
    expect(p.background).toBe('#000000');
    expect(p.surface).toBe('#000000');
  });

  it('contrasta: texto principal AAA, secundario AA sobre todas las superficies, acento AA', () => {
    expect(cr(p['on-surface'], p.background)).toBeGreaterThanOrEqual(7);
    for (const c of containers) expect(cr(p['on-surface-variant'], p[c])).toBeGreaterThanOrEqual(4.5);
    expect(cr(p.primary, p.background)).toBeGreaterThanOrEqual(4.5);
    expect(cr(p['on-primary'], p.primary)).toBeGreaterThanOrEqual(4.5);
    expect(cr(p['on-primary-container'], p['primary-container'])).toBeGreaterThanOrEqual(4.5);
    expect(cr(p['on-secondary-container'], p['secondary-container'])).toBeGreaterThanOrEqual(4.5);
  });
});
