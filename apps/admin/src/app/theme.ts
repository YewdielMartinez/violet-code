import { registerTheme } from '@yewdiel21/motion-kit/theme';

/** Clave de localStorage donde motion-kit guarda tema y modo. La usa también el script de <head> (vite.config.ts). */
export const THEME_STORAGE_KEY = 'vc-theme';

export interface CustomThemeDescriptor {
  readonly id: string;
  readonly label: string;
  /** Color de vista previa para el selector de tema (análogo a `seed` en motion-kit). */
  readonly swatch: string;
}

/** Tema personalizado Salmverse (Rosa salmón) definido en src/app/themes/salmverse.css. */
export const SALMVERSE_THEME: CustomThemeDescriptor = {
  id: 'salmverse',
  label: 'Salmverse (Rosa salmón)',
  swatch: '#ee6983',
};

/** Temas personalizados registrados fuera de la lista integrada de motion-kit. */
export const CUSTOM_THEMES: readonly CustomThemeDescriptor[] = [SALMVERSE_THEME];

let registered = false;

/**
 * Registra los temas propios de la aplicación en motion-kit para que `setTheme(id)`
 * los acepte sin advertencia y los persista en `vc-theme`.
 */
export function registerCustomThemes() {
  if (registered) return;
  registered = true;
  for (const theme of CUSTOM_THEMES) {
    registerTheme(theme.id);
  }
}
