import { Icon } from '@/shared/ui/Icon';
import { useRecentActivity, type AccionBitacora, type AuditEvent } from '../api';
import { relativeTime } from './format';
import { FitList } from './FitList';
import { WidgetCard, WidgetEmpty, WidgetSkeleton } from './shared';

const ACCION_MAP: Record<AccionBitacora, { verb: string; icon: string }> = {
  ver: { verb: 'consultó', icon: 'visibility' },
  crear: { verb: 'registró', icon: 'add' },
  actualizar: { verb: 'actualizó', icon: 'edit' },
  desactivar: { verb: 'desactivó', icon: 'cancel' },
};

const ROW_HEIGHT = 48;
const getKey = (e: AuditEvent) => e.id;
const MIN_COLUMN = 340;

function EventRow({ e }: { e: AuditEvent }) {
  const mapped = ACCION_MAP[e.accion];
  return (
    <div className="flex h-full items-center gap-3 rounded-2xl bg-surface-container-low px-3">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-container-high text-on-surface-variant"
      >
        <Icon name={mapped.icon} className="text-[18px]" />
      </span>
      <p className="min-w-0 flex-1 truncate text-sm text-on-surface">
        <span className="font-medium">{e.actorNombre ?? 'Sistema'}</span> {mapped.verb}{' '}
        <span className="font-mono text-xs text-on-surface-variant">{e.tablaAfectada}</span>
      </p>
      <time dateTime={e.creadoEn} className="shrink-0 text-xs text-on-surface-variant">
        {relativeTime(e.creadoEn)}
      </time>
    </div>
  );
}

/**
 * Actividad de seguridad (`bitacora_acceso`). Solo Titular / Subdirección.
 * Filas propias (no `ActivityFeed`) para que la lista se ajuste a la altura/anchura de la celda y se
 * actualice con cada consulta sin remontar el componente (ver MOTION-KIT-ISSUES #4).
 */
export function SecurityWidget() {
  const { data, isLoading, isError, refetch } = useRecentActivity(true);

  return (
    <WidgetCard
      title="Actividad de seguridad"
      icon="shield_lock"
      subtitle={data ? `${data.length} eventos recientes` : undefined}
    >
      {isLoading ? (
        <WidgetSkeleton />
      ) : isError ? (
        <WidgetEmpty error title="" onRetry={() => void refetch()} />
      ) : !data?.length ? (
        <WidgetEmpty icon="shield" title="Sin actividad reciente" description="Los accesos y cambios se listarán aquí." />
      ) : (
        <FitList
          label="Actividad de seguridad"
          items={data}
          getKey={getKey}
          rowHeight={ROW_HEIGHT}
          minColWidth={MIN_COLUMN}
          renderItem={(e) => <EventRow e={e} />}
        />
      )}
    </WidgetCard>
  );
}
