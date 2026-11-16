import { ActivityFeed, EmptyState } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/activity-feed';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { useRecentActivity, type AuditEvent } from './api';

type Kind = 'comment' | 'create' | 'update' | 'delete' | 'upload' | 'complete' | 'mention';

// Traducción de acciones de auditoría a lenguaje del equipo.
const ACTIONS: Record<string, { text: string; kind: Kind }> = {
  'auth.login.success': { text: 'inició sesión', kind: 'complete' },
  'auth.login.failure': { text: 'tuvo un intento de acceso fallido', kind: 'delete' },
  'auth.login.locked': { text: 'quedó bloqueada temporalmente por intentos fallidos', kind: 'delete' },
  'auth.logout': { text: 'cerró sesión', kind: 'update' },
};

function toItem(e: AuditEvent) {
  const known = ACTIONS[e.action];
  return {
    id: e.id,
    actor: e.actorName ?? 'Cuenta desconocida',
    action: known?.text ?? e.action,
    time: e.occurredAt,
    kind: known?.kind ?? 'update',
  };
}

/** Actividad de seguridad reciente (solo supervisión). Viene de la bitácora de auditoría. */
export function RecentActivity() {
  const { data, isLoading, isError } = useRecentActivity(true);

  if (isLoading) return <div className="h-64 animate-pulse rounded-3xl bg-surface-container" />;
  if (isError || !data?.length) {
    return (
      <EmptyState
        illustration={isError ? 'error' : 'inbox'}
        title={isError ? 'No se pudo cargar la actividad' : 'Sin actividad todavía'}
      />
    );
  }

  // key: al llegar datos nuevos se vuelve a montar con la lista actualizada.
  return <ActivityFeed key={data[0].id} items={data.map(toItem)} locale="es-MX" />;
}
