import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/menu';
import { logout } from '@/shared/auth/session';
import { Icon } from '@/shared/ui/Icon';
import { AppearanceMenu } from './AppearanceMenu';
import { SettingsDialog } from './SettingsDialog';

const OPTIONS = [
  { value: 'settings', label: 'Configuración', icon: 'settings' },
  { value: 'appearance', label: 'Apariencia', icon: 'palette' },
  { value: 'reload', label: 'Recargar', icon: 'refresh' },
  { value: 'logout', label: 'Cerrar sesión', icon: 'logout' },
] as const;

// Espera a que el menú de Opciones termine de cerrarse (y el foco vuelva a su botón)
// para que el siguiente panel crezca desde el botón del nav.
const AFTER_CLOSE_MS = 220;

/**
 * Botón de acción del nav (abajo): abre el menú "Opciones" de motion-kit.
 * Desde ahí: Configuración (diálogo) y Apariencia (panel del mismo menú).
 */
export function OptionsMenu() {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  async function onSelect(value: string) {
    switch (value) {
      case 'settings':
        setTimeout(() => setSettingsOpen(true), AFTER_CLOSE_MS);
        break;
      case 'appearance':
        setTimeout(() => setAppearanceOpen(true), AFTER_CLOSE_MS);
        break;
      case 'reload':
        window.location.reload();
        break;
      case 'logout':
        await logout();
        toast('Sesión cerrada', { tone: 'info' });
        navigate('/login', { replace: true });
        break;
    }
  }

  return (
    <>
      <Menu.Root onSelect={(value) => void onSelect(value)}>
        <Menu.Trigger className="mk-nav__button mk-nav__button--action" aria-label="Opciones">
          <span className="mk-nav__icon" aria-hidden>
            <Icon name="apps" />
          </span>
          <span className="mk-nav__name">Opciones</span>
        </Menu.Trigger>
        <Menu.Content className="vc-menu">
          <p className="px-[18px] pt-3 pb-4 text-2xl font-medium tracking-tight text-on-surface">Opciones</p>
          {OPTIONS.map((o) => (
            <Menu.Item key={o.value} value={o.value}>
              <Icon name={o.icon} filled />
              {o.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Root>

      <AppearanceMenu open={appearanceOpen} onOpenChange={setAppearanceOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
