import { useEffect, useMemo, ViewTransition } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { Nav } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/nav';
import { OptionsMenu } from '@/features/settings/OptionsMenu';
import { useAuth } from '@/shared/auth/useAuth';
import { BrandMark } from '@/shared/ui/BrandMark';
import { Icon } from '@/shared/ui/Icon';
import { getNavigationForRole } from './navigation';
import { useNavStyle } from './preferences';
import { preloadPages } from './pages';

export function AppLayout() {
  const outlet = useOutlet();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navStyle = useNavStyle();
  const { user } = useAuth();

  const navItems = useMemo(
    () =>
      getNavigationForRole(user?.role).map((page) => ({
        value: page.path,
        label: page.label,
        icon: <Icon name={page.icon} />,
        hideOnMobile: !page.mobile,
      })),
    [user?.role],
  );

  useEffect(() => preloadPages(), []);

  return (
    <div className="mk-shell h-dvh">
      <Nav
        aria-label="Navegación principal"
        // viewTransitionName: la navegación no se anima al cambiar de página (persistente).
        style={{ viewTransitionName: 'app-nav' }}
        navStyle={navStyle}
        // Sin `accent`: el activo es neutro (en el riel, el acento morado se encimaba entre botones).
        items={navItems}
        active={pathname}
        onSelect={(path, event) => {
          event.preventDefault();
          navigate(path);
        }}
        first={
          <button
            type="button"
            className="mk-nav__button mk-nav__button--first"
            onClick={() => navigate('/')}
            aria-label="Violet Code, ir al inicio"
          >
            {/* Marca propia en lugar de .mk-nav__icon: el logo SVG no es un glifo de Material Symbols. */}
            <BrandMark size={36} className="shrink-0" />
            <span className="mk-nav__name">Violet Code</span>
          </button>
        }
        actions={<OptionsMenu />}
      />

      <main className="mk-shell__view">
        {/* Cambio de página lateral (sin jerarquía): cruce suave. key = ruta: sale una página y entra otra. */}
        <ViewTransition key={pathname} enter="page-enter" exit="page-exit" default="none">
          {/* En dock el contenido usa todo el ancho; en los estilos laterales se limita para leer cómodo. */}
          <div className={`w-full px-2 py-4 md:px-6 md:py-6 ${navStyle === 'dock' ? '' : 'mx-auto max-w-[96rem]'}`}>
            {outlet}
          </div>
        </ViewTransition>
      </main>
    </div>
  );
}
