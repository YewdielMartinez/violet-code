import { ActivityFeed } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/activity-feed';
import { useRecentActivity, type AccionBitacora, type AuditEvent } from '../api';
import { WidgetCard, WidgetEmpty, WidgetLoading } from './shared';

type Kind = 'comment' | 'create' | 'update' | 'delete' | 'upload' | 'complete' | 'mention';

const ACCION_MAP: Record<AccionBitacora, { verb: string; kind: Kind }> = {
  ver: { verb: 'consultó', kind: 'comment' },
  crear: { verb: 'registró', kind: 'create' },
  actualizar: { verb: 'actualizó', kind: 'update' },
  desactivar: { verb: 'desactivó', kind: 'delete' },
};

const toItem = (e: AuditEvent) => {
  const mapped = ACCION_MAP[e.accion];
  return {
    id: e.id,
    actor: e.actorNombre ?? 'Sistema',
    action: `${mapped.verb} ${e.tablaAfectada}`,
    time: e.creadoEn,
    kind: mapped.kind,
  };
};

/** Actividad de seguridad (`bitacora_acceso`). Solo Titular / Subdirección. */
export function SecurityWidget() {
  const { data, isLoading, isError } = useRecentActivity(true);

  return (
    <WidgetCard title="Actividad de seguridad">
      {isLoading ? (
        <WidgetLoading />
      ) : isError || !data?.length ? (
        <WidgetEmpty error={isError} title="Sin actividad" />
      ) : (
        <ActivityFeed key={data[0].id} items={data.map(toItem)} locale="es-MX" />
      )}
    </WidgetCard>
  );
}
