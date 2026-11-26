import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Protege formularios extensos contra pérdida accidental (`docs/resiliencia-concurrencia-sesiones.md` §8):
 * - Activa `beforeunload` ante recarga (`F5`) o cierre de pestaña mientras `when === true`.
 * - Bloquea navegación interna en React Router para mostrar confirmación explícita.
 */
export function useUnsavedChangesGuard(when: boolean) {
  useEffect(() => {
    if (!when) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [when]);

  return useBlocker(when);
}
