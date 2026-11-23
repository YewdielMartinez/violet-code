import { useEffect, useRef } from 'react';
import { useTabs, useTheme } from '@yewdiel21/motion-kit/react';
import { Icon } from './Icon';

const MODES = [
  { value: 'light', label: 'Claro', icon: 'light_mode' },
  { value: 'system', label: 'Sistema', icon: 'contrast' },
  { value: 'dark', label: 'Oscuro', icon: 'dark_mode' },
] as const;

/**
 * Selector de modo con el control segmentado de motion-kit (el indicador se desliza).
 * "Sistema" sigue la preferencia del equipo; la elección se guarda en el navegador.
 */
export function ThemeModeSelector({ compact = false, fill = false }: { compact?: boolean; fill?: boolean }) {
  const { mode, setMode } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const tabs = useTabs(ref, {
    onSelect: (index) => setMode(MODES[index].value),
  });

  // Si el modo cambia desde otro lugar, el indicador lo sigue.
  useEffect(() => {
    const index = MODES.findIndex((m) => m.value === mode);
    if (tabs.current && index >= 0 && tabs.current.index !== index) tabs.current.select(index);
  }, [mode, tabs]);

  const initial = Math.max(0, MODES.findIndex((m) => m.value === mode));

  return (
    <div ref={ref} className={`mk-segmented ${fill ? 'w-full' : ''}`} role="tablist" aria-label="Apariencia">
      {MODES.map((m, i) => (
        <button
          key={m.value}
          type="button"
          role="tab"
          data-mk-tab
          aria-selected={i === initial}
          aria-label={compact ? m.label : undefined}
          title={m.label}
          className={`inline-flex items-center justify-center gap-2 ${fill ? 'flex-1 px-3' : ''}`}
        >
          <Icon name={m.icon} className="text-[20px]" />
          {!compact && <span>{m.label}</span>}
        </button>
      ))}
      <span data-mk-indicator="" />
    </div>
  );
}
