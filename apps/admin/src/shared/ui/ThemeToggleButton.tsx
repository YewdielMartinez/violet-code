import { useTheme } from '@yewdiel21/motion-kit/react';
import { Icon } from './Icon';

/** Botón directo para alternar entre modo claro y oscuro usando ThemeProvider de motion-kit. */
export function ThemeToggleButton({ variant = 'header' }: { variant?: 'nav' | 'header' }) {
  const { resolved, setMode } = useTheme();
  const isDark = resolved === 'dark';
  const nextLabel = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  const icon = isDark ? 'light_mode' : 'dark_mode';

  if (variant === 'nav') {
    return (
      <button
        type="button"
        className="mk-nav__button mk-nav__button--action"
        onClick={() => setMode(isDark ? 'light' : 'dark')}
        aria-label={nextLabel}
        title={nextLabel}
      >
        <span className="mk-nav__icon" aria-hidden>
          <Icon name={icon} />
        </span>
        <span className="mk-nav__name">{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="mk-button mk-button--tonal mk-button--sm inline-flex items-center gap-2"
      onClick={() => setMode(isDark ? 'light' : 'dark')}
      aria-label={nextLabel}
      title={nextLabel}
    >
      <Icon name={icon} className="text-[18px]" />
      <span>{isDark ? 'Claro' : 'Oscuro'}</span>
    </button>
  );
}
