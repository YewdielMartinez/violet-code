import { APP_NAME } from '@/app/brand';
import {
  lazy,
  startTransition,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  ViewTransition,
  type FocusEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { Nav } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/nav';
import { useAuth } from '@/shared/auth/useAuth';
import { BrandMark } from '@/shared/ui/BrandMark';
import { Icon } from '@/shared/ui/Icon';
import { getMobilePaths, getNavigationForRole } from './navigation';
import { useNavStyle } from './preferences';
import { preloadPage, preloadPages } from './pages';

const loadOptionsMenu = () => import('@/features/settings/OptionsMenu').then((m) => ({ default: m.OptionsMenu }));
const LazyOptionsMenu = lazy(loadOptionsMenu);

/** Botón liviano que imita el trigger de Opciones hasta cargar el menú y los diálogos de configuración. */
function OptionsTriggerFallback({ onIntent }: { onIntent: (open: boolean) => void }) {
  return (
    <button
      type="button"
      className="mk-nav__button mk-nav__button--action"
      aria-label="Opciones"
      aria-haspopup="menu"
      aria-expanded={false}
      onPointerEnter={() => onIntent(false)}
      onFocus={() => onIntent(false)}
      onClick={() => onIntent(true)}
    >
      <span className="mk-nav__icon" aria-hidden>
        <Icon name="apps" />
      </span>
      <span className="mk-nav__name">Opciones</span>
    </button>
  );
}

/** Si la persona hizo clic antes de que terminara de cargar OptionsMenu, abre el menú al montar. */
function OpenOnMount({
  hostRef,
  pendingOpenRef,
}: {
  hostRef: RefObject<HTMLSpanElement | null>;
  pendingOpenRef: RefObject<boolean>;
}) {
  useEffect(() => {
    if (!pendingOpenRef.current) return;
    pendingOpenRef.current = false;
    const btn = hostRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Opciones"]');
    btn?.focus();
    btn?.click();
  }, [hostRef, pendingOpenRef]);

  return null;
}

function DeferredOptionsMenu() {
  const [mounted, setMounted] = useState(false);
  const hostRef = useRef<HTMLSpanElement>(null);
  const pendingOpenRef = useRef(false);

  function activate(openAfterMount: boolean) {
    if (openAfterMount) pendingOpenRef.current = true;
    void loadOptionsMenu();
    if (!mounted) {
      startTransition(() => setMounted(true));
    }
  }

  const fallback = <OptionsTriggerFallback onIntent={activate} />;

  return (
    <span ref={hostRef} className="contents">
      {mounted ? (
        <Suspense fallback={fallback}>
          <LazyOptionsMenu />
          <OpenOnMount hostRef={hostRef} pendingOpenRef={pendingOpenRef} />
        </Suspense>
      ) : (
        fallback
      )}
    </span>
  );
}

function preloadFromEvent(event: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const value = target.closest<HTMLElement>('[data-mk-value]')?.dataset.mkValue;
  if (value) preloadPage(value);
}

export function AppLayout() {
  const outlet = useOutlet();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navStyle = useNavStyle();
  const { user } = useAuth();

  const navItems = useMemo(() => {
    // Barra móvil por rol: las 5 páginas de mayor prioridad a las que el rol tiene acceso.
    const mobilePaths = getMobilePaths(user?.role);
    return getNavigationForRole(user?.role).map((page) => ({
      value: page.path,
      label: page.label,
      icon: <Icon name={page.icon} />,
      hideOnMobile: !mobilePaths.has(page.path),
    }));
  }, [user?.role]);

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
        active={pathname.startsWith('/expedientes') ? '/expedientes' : pathname}
        onPointerOver={preloadFromEvent}
        onFocus={preloadFromEvent}
        onSelect={(path, event) => {
          event.preventDefault();
          navigate(path);
        }}
        first={
          <button
            type="button"
            className="mk-nav__button mk-nav__button--first"
            onPointerEnter={() => preloadPage('/')}
            onFocus={() => preloadPage('/')}
            onClick={() => navigate('/')}
            aria-label={`${APP_NAME}, ir al inicio`}
          >
            {/* Marca propia en lugar de .mk-nav__icon: el logo SVG no es un glifo de Material Symbols. */}
            <BrandMark size={36} className="shrink-0" />
            <span className="mk-nav__name">{APP_NAME}</span>
          </button>
        }
        actions={<DeferredOptionsMenu />}
      />

      <main className="mk-shell__view">
        {/* Cambio de página lateral (sin jerarquía): cruce suave. key = ruta: sale una página y entra otra. */}
        <ViewTransition key={pathname} enter="page-enter" exit="page-exit" default="none">
          <div className="w-full pt-0 pb-6">
            {outlet}
          </div>
        </ViewTransition>
      </main>
    </div>
  );
}
