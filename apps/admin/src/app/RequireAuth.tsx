import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { refreshSession } from '@/shared/auth/session';
import { useAuth } from '@/shared/auth/useAuth';

/** Protege las rutas del panel. Al cargar intenta recuperar la sesión con la cookie de refresh. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

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

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
