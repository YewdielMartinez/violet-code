// Genera el tema "violet" con el motor de motion-kit (Material 3).
// Misma línea de diseño de motion-kit: solo cambia el color semilla.
// Salidas:
//   dist/violet.css      -> Admin (React): [data-mk-theme="violet"], light + dark
//   dist/tokens.json     -> fuente neutral (docs, pruebas, otras plataformas)
//   dist/VioletColors.kt -> Mobile (Jetpack Compose): lightScheme / darkScheme
//
// Ver docs/adr/0002-sistema-de-diseno-motion-kit.md
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTheme, themeCss } from '@yewdiel21/motion-kit/theme/generate';

// PENDIENTE DE VALIDAR: manual de identidad de SEMUJERES / Ayuntamiento de Ahome.
const SEED = process.env.VIOLET_SEED ?? '#7B2CBF';
const VARIANT = process.env.VIOLET_VARIANT ?? 'vibrant';
const THEME_ID = 'violet';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../dist');
mkdirSync(out, { recursive: true });

const palettes = generateTheme(SEED, { variant: VARIANT, contrast: 0 });

writeFileSync(resolve(out, 'violet.css'), themeCss(THEME_ID, palettes));

writeFileSync(
  resolve(out, 'tokens.json'),
  JSON.stringify({ id: THEME_ID, seed: SEED, variant: VARIANT, ...palettes }, null, 2) + '\n',
);

const camel = (role) => role.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const argb = (hex) => `Color(0xFF${hex.replace('#', '').toUpperCase()})`;
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
const scheme = (fn, palette) =>
  `val ${fn === 'lightColorScheme' ? 'VioletLightScheme' : 'VioletDarkScheme'} = ${fn}(\n` +
  Object.entries(palette)
    .filter(([role]) => COMPOSE_ROLES.has(role))
    .map(([role, hex]) => `    ${camel(role)} = ${argb(hex)},`)
    .join('\n') +
  '\n)\n';

const kotlin =
  `// GENERADO por packages/design-tokens/scripts/build.mjs — no editar a mano. Regenerar: npm run tokens\n` +
  `// seed=${SEED} variant=${VARIANT}\n` +
  `package mx.violetcode.mobile.ui.theme\n\n` +
  `import androidx.compose.material3.darkColorScheme\n` +
  `import androidx.compose.material3.lightColorScheme\n` +
  `import androidx.compose.ui.graphics.Color\n\n` +
  scheme('lightColorScheme', palettes.light) +
  '\n' +
  scheme('darkColorScheme', palettes.dark);

writeFileSync(resolve(out, 'VioletColors.kt'), kotlin);

// Copia directa al proyecto Android (mismo color en web y móvil).
const mobileTheme = resolve(here, '../../../apps/mobile/app/src/main/java/mx/violetcode/mobile/ui/theme');
mkdirSync(mobileTheme, { recursive: true });
writeFileSync(resolve(mobileTheme, 'VioletColors.kt'), kotlin);

console.log(`violet theme -> ${out} (seed ${SEED}, ${VARIANT}) primary light ${palettes.light.primary} / dark ${palettes.dark.primary}`);
