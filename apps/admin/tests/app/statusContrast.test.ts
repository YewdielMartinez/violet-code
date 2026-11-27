import { describe, expect, it } from 'vitest';

import indexCss from '../../src/index.css?raw';
import blueContrastCss from '../../src/app/themes/blue-contrast.css?raw';
import blueCss from '../../../../node_modules/@yewdiel21/motion-kit/dist/css/themes/blue.css?raw';
import salmverseCss from '../../src/app/themes/salmverse.css?raw';

const lum = (h: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const cr = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const roles = (block: string, prefix: string) => {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(new RegExp(String.raw`--${prefix}-([a-z-]+):\s*(#[0-9a-f]{6});`, 'gi'))) out[m[1]] = m[2].toLowerCase();
  return out;
};
/** Bloque `{ ... }` que contiene la n-ésima (0 = primera) aparición de `marker`. */
const blockAt = (css: string, marker: string, nth = 0) => {
  let start = -1;
  for (let i = 0; i <= nth; i += 1) start = css.indexOf(marker, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};

const TONES = ['success', 'warning', 'info', 'danger'] as const;

describe('tonos de estado (--vc-status-*)', () => {
  const light = roles(blockAt(indexCss, '--vc-status-success:'), 'vc-status');
  const dark = roles(blockAt(indexCss, ":root[data-mk-mode='dark'] {"), 'vc-status');

  it.each(TONES)('modo claro: %s cumple 4.5:1 sobre su fondo y sobre blanco', (tone) => {
    expect(cr(light[tone], light[`${tone}-bg`])).toBeGreaterThanOrEqual(4.5);
    expect(cr(light[tone], '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TONES)('modo oscuro: %s cumple 4.5:1 sobre su fondo y sobre negro', (tone) => {
    expect(cr(dark[tone], dark[`${tone}-bg`])).toBeGreaterThanOrEqual(4.5);
    expect(cr(dark[tone], '#000000')).toBeGreaterThanOrEqual(4.5);
  });

  it('el tono neutral (on-surface-variant sobre surface-container-high de salmverse) cumple 4.5:1', () => {
    const p = roles(blockAt(salmverseCss, '[data-mk-theme="salmverse"] {'), 'md-sys-color');
    expect(cr(p['on-surface-variant'], p['surface-container-high'])).toBeGreaterThanOrEqual(4.5);
  });

  it('info es un azul marino sereno (>= 7:1 en claro) y la variante oscura se repite en la media query', () => {
    expect(cr(light.info, light['info-bg'])).toBeGreaterThanOrEqual(7);
    const afterDark = indexCss.slice(indexCss.indexOf(":root[data-mk-mode='dark']"));
    const media = roles(blockAt(afterDark, "--vc-status-success:", 1), 'vc-status');
    expect(media.info).toBe(dark.info);
    expect(media['info-bg']).toBe(dark['info-bg']);
  });
});

describe('tema blue en modo claro (kit + blue-contrast.css)', () => {
  const kit = roles(blockAt(blueCss, '[data-mk-theme="blue"] {'), 'md-sys-color');
  const over = roles(blockAt(blueContrastCss, '[data-mk-theme="blue"] {'), 'md-sys-color');
  const p = { ...kit, ...over };
  const surfaces = [
    'background',
    'surface',
    'surface-container-lowest',
    'surface-container-low',
    'surface-container',
    'surface-container-high',
    'surface-container-highest',
  ];

  it('blue-contrast.css se importa después del kit y antes de dark-black.css', () => {
    const iKit = indexCss.indexOf('motion-kit/css/themes/blue');
    const iFix = indexCss.indexOf('./app/themes/blue-contrast.css');
    const iDark = indexCss.indexOf('./app/themes/dark-black.css');
    expect(iKit).toBeGreaterThan(-1);
    expect(iFix).toBeGreaterThan(iKit);
    expect(iDark).toBeGreaterThan(iFix);
  });

  it('pares de texto clave >= 4.5:1', () => {
    expect(cr(p['on-primary'], p.primary)).toBeGreaterThanOrEqual(4.5);
    expect(cr(p['on-primary-container'], p['primary-container'])).toBeGreaterThanOrEqual(4.5);
    expect(cr(p['on-secondary-container'], p['secondary-container'])).toBeGreaterThanOrEqual(4.5);
    expect(cr(p['on-tertiary-container'], p['tertiary-container'])).toBeGreaterThanOrEqual(4.5);
    expect(cr(p.primary, p.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(surfaces)('outline >= 4.5:1 sobre %s', (surface) => {
    expect(cr(p.outline, p[surface])).toBeGreaterThanOrEqual(4.5);
  });

  it('el kit por sí solo no cumpliría outline sobre el fondo (motivo del override)', () => {
    expect(cr(kit.outline, kit.background)).toBeLessThan(4.5);
  });
});
