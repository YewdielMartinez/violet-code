import { ActivityFeed } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/activity-feed';
import { useRecentActivity, type AuditEvent } from '../api';
import { WidgetCard, WidgetEmpty, WidgetLoading } from './shared';

type Kind = 'comment' | 'create' | 'update' | 'delete' | 'upload' | 'complete' | 'mention';

// Traducción de acciones de auditoría a lenguaje del equipo.
const ACTIONS: Record<string, { text: string; kind: Kind }> = {
  'auth.login.success': { text: 'inició sesión', kind: 'complete' },
  'auth.login.failure': { text: 'tuvo un intento de acceso fallido', kind: 'delete' },
  'auth.login.locked': { text: 'quedó bloqueada por intentos fallidos', kind: 'delete' },
  'auth.logout': { text: 'cerró sesión', kind: 'update' },
  'case.list': { text: 'consultó expedientes', kind: 'comment' },
};

const toItem = (e: AuditEvent) => {
  const known = ACTIONS[e.action];
  return {
    id: e.id,
    actor: e.actorName ?? 'Cuenta desconocida',
    action: known?.text ?? e.action,
    time: e.occurredAt,
    kind: known?.kind ?? ('update' as Kind),
  };
};

/** Actividad de seguridad (bitácora de auditoría). Solo supervisión. */
export function SecurityWidget() {
  const { data, isLoading, isError } = useRecentActivity(true);

  return (
    <WidgetCard title="Actividad de seguridad" action={{ label: 'Auditoría', to: '/auditoria' }}>
      {isLoading ? (
        <WidgetLoading />
      ) : isError || !data?.length ? (
        <WidgetEmpty error={isError} title="Sin actividad" />
      ) : (
        // key: al llegar eventos nuevos se remonta con la lista actualizada (MOTION-KIT-ISSUES #4).
        <ActivityFeed key={data[0].id} items={data.map(toItem)} locale="es-MX" />
      )}
    </WidgetCard>
  );
}
