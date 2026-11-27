import { Dialog, EmptyState, Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import type { AgendaItem } from '@/domain/models/Cita';
import { puedeAgendarProximaCita, type AsistenciaCita } from '@/domain/models/HojaSeguimiento';
import { SeguimientoForm } from '@/features/intervenciones/SeguimientoForm';
import { useContextoCita } from '@/features/intervenciones/api';
import { useAuth } from '@/shared/auth/useAuth';
import type { CitaDir } from './citaDialogUtils';
import { useDialogSettled } from './useDialogSettled';

export interface CitaSeguimientoViewProps {
  cita: AgendaItem;
  dir: CitaDir;
  onDone: (asistencia: AsistenciaCita) => void;
}

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

/**
 * Hoja de seguimiento embebida (`RF-09`, `RN-13`). La asistencia NO se marca antes: `registrar_seguimiento`
 * pone la cita en «asistió» dentro de la misma transacción que crea la hoja (y `SeguimientoForm` usa
 * `cambiar_estado_cita` solo para «no asistió»), así que no hay llamada doble.
 *
 * El formulario (Selects, switches, scroll areas) es la vista más pesada: no se monta hasta que termina el morph de
 * apertura (`useDialogSettled`); mientras tanto, y mientras llega el expediente, se ve el esqueleto del kit.
 */
export function CitaSeguimientoView({ cita, dir, onDone }: CitaSeguimientoViewProps) {
  const { user } = useAuth();
  const contextoQuery = useContextoCita(cita.citaId, cita.personaId);
  const contexto = contextoQuery.data;
  const settled = useDialogSettled();
  const cargando = !settled || contextoQuery.isLoading;

  return (
    <Dialog.Body className="vc-cita-view" data-dir={dir}>
      {contextoQuery.isError ? (
        <EmptyState
          illustration="error"
          title="No se pudo cargar el expediente"
          actions={RETRY_ACTION}
          onAction={() => void contextoQuery.refetch()}
        />
      ) : (
        <Skeleton loading={cargando} shape="card" lines={5} label="Cargando expediente">
          {cargando ? null : contexto ? (
            <SeguimientoForm
              cita={cita}
              contexto={contexto}
              areaId={user?.areaId ?? null}
              permiteAgendar={puedeAgendarProximaCita(user?.role)}
              onDone={onDone}
            />
          ) : (
            <EmptyState
              illustration="search"
              title="La persona aún no tiene Ficha Única"
              description="Trabajo Social debe registrar la Ficha Única antes de llenar la hoja de seguimiento."
            />
          )}
        </Skeleton>
      )}
    </Dialog.Body>
  );
}
