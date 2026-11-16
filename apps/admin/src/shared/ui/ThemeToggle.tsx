import { GlassSwitch, useTheme } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/glass-switch';

/** Interruptor claro/oscuro de motion-kit (sol/luna). La elección se guarda en el navegador. */
export function ThemeToggle() {
  const { resolved, setMode } = useTheme();
  return (
    <GlassSwitch
      icons="theme"
      size="sm"
      label="Modo oscuro"
      checked={resolved === 'dark'}
      onChange={(dark) => setMode(dark ? 'dark' : 'light')}
    />
  );
}
