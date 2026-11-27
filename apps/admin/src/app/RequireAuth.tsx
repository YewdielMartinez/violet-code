import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { refreshSession } from '@/shared/auth/session';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { canAccessPath } from './navigation';

/** Protege las rutas del panel validando sesión en Supabase Auth y permisos por rol. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'checking') void refreshSession();
  }, [status]);

  if (status === 'checking') {
    return (
      <div className="grid min-h-full place-items-center" role="status" aria-label="Verificando sesión">
        <span className="size-10 animate-spin rounded-full border-4 border-primary-container border-t-primary" />
      </div>
    );
  }

  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessPath(user.role, location.pathname)) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <div className="rounded-3xl bg-surface-container-low p-10">
          {/* Marcado propio (no EmptyState del kit): el guard va en la ruta crítica de TODO el panel y el
              barril de motion-kit arrastraría GSAP (~61 kB gzip) y más CSS solo para este caso raro. */}
          <div role="alert" className="flex flex-col items-center gap-3 text-center">
            <Icon name="lock" className="text-5xl text-error" />
            <h2 className="text-xl font-semibold text-on-surface">Acceso restringido</h2>
            <p className="max-w-md text-on-surface-variant">
              Tu rol actual no tiene permisos para acceder a este módulo.
            </p>
            <button
              type="button"
              className="mt-2 rounded-full bg-primary px-6 py-2.5 font-medium text-on-primary"
              onClick={() => navigate('/', { replace: true })}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
