// Fuente única de color: el tema "salmverse" del panel (apps/admin/src/app/themes/salmverse.css), que es el
// tema por defecto de la aplicación de escritorio. El modo oscuro es negro puro (#000000) con superficies
// neutras (mismo contenido que themes/dark-black.css, que salmverse ya incluye en su bloque oscuro).
//   - Admin (React) carga esos CSS directamente.
//   - Este script los traduce para Android (Compose) y a JSON neutral.
// Salidas:
//   dist/tokens.json      -> { light, dark } con los 37 roles Material 3
//   dist/VioletColors.kt  -> VioletLightScheme / VioletDarkScheme (copia en apps/mobile/core/designsystem)
//
// Regenerar: npm run tokens   ·   Ver docs/adr/0002-sistema-de-diseno-motion-kit.md
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const THEME = process.env.VIOLET_THEME ?? 'salmverse';

const here = dirname(fileURLToPath(import.meta.url));
const themesDir = resolve(here, '../../../apps/admin/src/app/themes');
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ''); // sin comentarios: los selectores quedan limpios
const css = strip(readFileSync(resolve(themesDir, `${THEME}.css`), 'utf8'));

/** Lee los --md-sys-color-* del primer bloque cuyo selector cumpla `match`. */
function readPalette(source, match) {
  const blocks = [...source.matchAll(/([^{}]+)\{([^{}]+)\}/g)];
  const block = blocks.find(([, selector]) => match(selector.trim()));
  if (!block) throw new Error(`No se encontró el bloque del tema ${THEME}`);
  return Object.fromEntries(
    [...block[2].matchAll(/--md-sys-color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map(([, role, hex]) => [role, hex.toLowerCase()]),
  );
}

const light = readPalette(css, (s) => s === `[data-mk-theme="${THEME}"]`);
const dark = readPalette(css, (s) => s.startsWith(`[data-mk-theme="${THEME}"][data-mk-mode="dark"]`));

// Neutros oscuros compartidos (dark-black.css): si el tema define menos de los 37 roles, completan el modo oscuro.
try {
  const black = strip(readFileSync(resolve(themesDir, 'dark-black.css'), 'utf8'));
  const overrides = readPalette(black, (s) => s.startsWith(`[data-mk-theme="${THEME}"][data-mk-mode="dark"]`));
  Object.assign(dark, overrides);
} catch {
  // dark-black.css no incluye este tema: el bloque oscuro del propio tema ya es completo.
}

if (Object.keys(light).length < 37 || Object.keys(dark).length < 37) {
  throw new Error(`Paleta incompleta (light ${Object.keys(light).length}, dark ${Object.keys(dark).length})`);
}

const out = resolve(here, '../dist');
mkdirSync(out, { recursive: true });

writeFileSync(resolve(out, 'tokens.json'), JSON.stringify({ theme: THEME, source: `apps/admin/src/app/themes/${THEME}.css`, light, dark }, null, 2) + '\n');

const camel = (role) => role.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const argb = (hex) => `Color(0xFF${hex.slice(1).toUpperCase()})`;
// Roles que existen en androidx.compose.material3.ColorScheme
const COMPOSE_ROLES = new Set([
  'primary', 'on-primary', 'primary-container', 'on-primary-container', 'inverse-primary',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'background', 'on-background', 'surface', 'on-surface', 'surface-variant', 'on-surface-variant',
  'surface-tint', 'inverse-surface', 'inverse-on-surface',
  'error', 'on-error', 'error-container', 'on-error-container',
  'outline', 'outline-variant', 'scrim',
  'surface-bright', 'surface-dim', 'surface-container', 'surface-container-high',
  'surface-container-highest', 'surface-container-low', 'surface-container-lowest',
]);
const scheme = (name, fn, palette) =>
  `val ${name} = ${fn}(\n` +
  Object.entries(palette)
    .filter(([role]) => COMPOSE_ROLES.has(role))
    .map(([role, hex]) => `    ${camel(role)} = ${argb(hex)},`)
    .join('\n') +
  '\n)\n';

const kotlin =
  `// GENERADO por packages/design-tokens/scripts/build.mjs desde el tema "${THEME}" del panel (apps/admin/src/app/themes).\n` +
  `// No editar a mano. Regenerar: npm run tokens\n` +
  `package mx.violetcode.mobile.core.designsystem.theme\n\n` +
  `import androidx.compose.material3.darkColorScheme\n` +
  `import androidx.compose.material3.lightColorScheme\n` +
  `import androidx.compose.ui.graphics.Color\n\n` +
  scheme('VioletLightScheme', 'lightColorScheme', light) +
  '\n' +
  scheme('VioletDarkScheme', 'darkColorScheme', dark);

writeFileSync(resolve(out, 'VioletColors.kt'), kotlin);

const mobileTheme = resolve(here, '../../../apps/mobile/core/designsystem/src/main/java/mx/violetcode/mobile/core/designsystem/theme');
mkdirSync(mobileTheme, { recursive: true });
writeFileSync(resolve(mobileTheme, 'VioletColors.kt'), kotlin);

console.log(`tema ${THEME} (panel) -> tokens.json + VioletColors.kt · primary claro ${light.primary} / oscuro ${dark.primary}`);
