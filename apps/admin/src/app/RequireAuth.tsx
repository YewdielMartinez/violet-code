import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { EmptyState } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { refreshSession } from '@/shared/auth/session';
import { useAuth } from '@/shared/auth/useAuth';
import { canAccessPath } from './navigation';

const BACK_HOME = [{ id: 'home', label: 'Volver al inicio' }];

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
          <EmptyState
            illustration="error"
            title="Acceso restringido"
            description="Tu rol actual no tiene permisos para acceder a este módulo."
            actions={BACK_HOME}
            onAction={() => navigate('/', { replace: true })}
          />
        </div>
      </div>
    );
  }

  return children;
}
