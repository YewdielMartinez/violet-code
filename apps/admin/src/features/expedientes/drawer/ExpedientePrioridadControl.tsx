import { memo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Select, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/select';
import { PRIORIDAD_CITA_LABELS, type PrioridadNivel } from '@/domain/models/Cita';
import { puedeCambiarPrioridad } from '@/domain/models/FichaRegistro';
import type { EstadoFicha } from '@/domain/models/Persona';
import { useAuth } from '@/shared/auth/useAuth';
import { handleExpedienteMutationError, useCambiarPrioridad, useFichaDetail } from '../api';

interface Props {
  fichaId: string;
  estado: EstadoFicha;
}

const PRIORIDAD_OPTIONS: { value: PrioridadNivel; label: string }[] = [
  { value: 'alta', label: PRIORIDAD_CITA_LABELS.alta },
  { value: 'media', label: PRIORIDAD_CITA_LABELS.media },
  { value: 'baja', label: PRIORIDAD_CITA_LABELS.baja },
];

const PRIORIDAD_BADGE_CLASSES: Record<PrioridadNivel, string> = {
  alta: 'bg-status-danger-bg text-status-danger',
  media: 'bg-status-warning-bg text-status-warning',
  baja: 'bg-surface-container-high text-on-surface-variant',
};

/** Selector de prioridad del expediente en cabecera (deshabilitado si está archivado o sin acceso). */
export const ExpedientePrioridadControl = memo(function ExpedientePrioridadControl({
  fichaId,
  estado,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: detail } = useFichaDetail(fichaId);
  const cambiarPrioridad = useCambiarPrioridad(fichaId);

  const canChange = estado !== 'archivado' && puedeCambiarPrioridad(user?.role);
  const current = detail?.prioridad ?? null;

  async function handleChange(nextRaw: string) {
    const next = nextRaw as PrioridadNivel;
    if (!next || next === current) return;
    try {
      await cambiarPrioridad.mutateAsync(next);
      toast(`Prioridad actualizada a ${PRIORIDAD_CITA_LABELS[next].toLowerCase()}.`, {
        tone: 'success',
      });
    } catch (err) {
      handleExpedienteMutationError(
        err,
        queryClient,
        fichaId,
        'No se pudo actualizar la prioridad del expediente.',
      );
    }
  }

  if (!canChange) {
    if (!current) return null;
    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${PRIORIDAD_BADGE_CLASSES[current]}`}
      >
        Prioridad: {PRIORIDAD_CITA_LABELS[current]}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-xs font-medium text-on-surface-variant">Prioridad:</span>
      <div className="min-w-[132px]">
        <Select
          size="sm"
          label="Prioridad del expediente"
          placeholder="Sin prioridad"
          disabled={cambiarPrioridad.isPending}
          options={PRIORIDAD_OPTIONS}
          value={current ?? ''}
          onChange={(val) => void handleChange(val)}
        />
      </div>
    </div>
  );
});
