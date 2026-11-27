import type { CSSProperties } from 'react';
import { Menu, ThemePicker, useTheme } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/theme-picker';
import { NAV_STYLES, setNavStyle, THEME_CHOICES, useNavStyle } from '@/app/preferences';
import { CUSTOM_THEMES, registerCustomThemes } from '@/app/theme';
import { Icon } from '@/shared/ui/Icon';
import { ThemeModeSelector } from '@/shared/ui/ThemeModeSelector';

/**
 * Apariencia como panel del mismo menú (motion-kit Menu): crece desde el botón de Opciones del nav.
 * No se cierra al elegir: se puede probar tema, modo y navegación seguidos.
 */
export function AppearanceMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navStyle = useNavStyle();
  const { id: activeTheme, setTheme } = useTheme();

  function selectCustomTheme(id: string) {
    registerCustomThemes();
    setTheme(id);
  }

  return (
    <Menu.Root open={open} onOpenChange={onOpenChange} closeOnSelect={false}>
      <Menu.Content className="vc-menu" aria-label="Apariencia">
        <div className="grid w-[22rem] max-w-full gap-6 p-3">
          <p className="flex items-center gap-2 text-2xl font-medium tracking-tight text-on-surface">
            <Icon name="palette" filled />
            Apariencia
          </p>

          {/* ThemePicker de motion-kit 0.20.3 solo renderiza presets en THEMES; envolvemos un único
              .mk-theme-picker para integrar los temas personalizados en la misma rejilla de swatches. */}
          <div className="mk-theme-picker" role="group" aria-label="Color del tema">
            <ThemePicker unstyled className="contents" themes={THEME_CHOICES} labels={{ group: 'Color del tema' }} />
            {CUSTOM_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className="mk-swatch"
                data-mk-swatch={theme.id}
                aria-pressed={activeTheme === theme.id}
                aria-label={theme.label}
                title={theme.label}
                style={{ '--mk-swatch': theme.swatch } as CSSProperties}
                onClick={() => selectCustomTheme(theme.id)}
              />
            ))}
          </div>

          <section className="grid gap-3">
            <h3 className="text-sm text-on-surface-variant">Modo</h3>
            <ThemeModeSelector fill />
          </section>

          <section className="grid gap-3">
            <h3 className="text-sm text-on-surface-variant">Navegación</h3>
            <div role="radiogroup" aria-label="Estilo de navegación" className="grid grid-cols-3 gap-2">
              {NAV_STYLES.map((s) => {
                const selected = s.id === navStyle;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setNavStyle(s.id)}
                    className={`mk-button mk-button--sm ${selected ? 'mk-button--primary' : 'mk-button--tonal'}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </Menu.Content>
    </Menu.Root>
  );
}
