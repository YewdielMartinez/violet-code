import { ViewTransition } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { Nav, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/nav';
import { logout } from '@/shared/auth/session';
import { ROLE_LABELS, useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { ThemeModeSelector } from '@/shared/ui/ThemeModeSelector';
import { NAVIGATION } from './navigation';

// Estático: se calcula una vez. En el teléfono Nav se vuelve barra inferior con las páginas `mobile`.
const NAV_ITEMS = NAVIGATION.map((page) => ({
  value: page.path,
  label: page.label,
  icon: <Icon name={page.icon} className="mk-nav__icon" />,
  hideOnMobile: !page.mobile,
}));

function UserMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const initials = user.displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');

  async function onLogout() {
    await logout();
    toast('Sesión cerrada', { tone: 'info' });
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="grid size-9 place-items-center rounded-full bg-secondary-container text-sm font-semibold text-on-secondary-container">
        {initials}
      </span>
      <div className="hidden leading-tight sm:block">
        <p className="text-sm font-medium text-on-surface">{user.displayName}</p>
        <p className="text-xs text-on-surface-variant">{ROLE_LABELS[user.role]}</p>
      </div>
      <button type="button" className="mk-button mk-button--text mk-button--icon" aria-label="Cerrar sesión" onClick={onLogout}>
        <Icon name="logout" />
      </button>
    </div>
  );
}

export function AppLayout() {
  const outlet = useOutlet();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="mk-shell h-dvh">
      <Nav
        aria-label="Navegación principal"
        // viewTransitionName: la navegación no se anima al cambiar de página (persistente).
        style={{ viewTransitionName: 'app-nav' }}
        navStyle="sidebar"
        accent
        items={NAV_ITEMS}
        active={pathname}
        onSelect={(path, event) => {
          event.preventDefault();
          navigate(path);
        }}
        first={
          <button type="button" className="mk-nav__button mk-nav__button--first" onClick={() => navigate('/')}>
            <span aria-hidden className="mk-nav__icon grid size-8 place-items-center rounded-xl bg-primary font-semibold text-on-primary">
              V
            </span>
            <span className="mk-nav__label">Violet Code</span>
          </button>
        }
      />

      <div className="mk-shell__view">
        <header style={{ viewTransitionName: 'app-topbar' }} className="flex items-center justify-between gap-4 pb-2">
          <p className="rounded-full bg-tertiary-container px-3 py-1 text-xs text-on-tertiary-container">
            Demostración · datos sintéticos
          </p>
          <div className="flex items-center gap-4">
            <ThemeModeSelector compact />
            <UserMenu />
          </div>
        </header>

        {/* Cambio de página lateral (sin jerarquía): cruce suave. key = ruta: sale una página y entra otra. */}
        <ViewTransition key={pathname} enter="page-enter" exit="page-exit" default="none">
          <div className="px-0 py-4 md:px-4">{outlet}</div>
        </ViewTransition>
      </div>
    </div>
  );
}
