import { StatCard } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/stat-card';
import { Icon } from '@/shared/ui/Icon';
import { useAlertsSummary, useCasesSummary, useSchedulingSummary } from '../api';
import { dayAndTime } from './format';

// Conteos: siempre enteros (también mientras StatCard anima el número).
const INTEGER = { maximumFractionDigits: 0 };

/** Resumen del día: lo urgente (alertas) destacado; lo demás, en tarjetas neutras. */
export function KpisWidget({ mine }: { mine: boolean }) {
  const alerts = useAlertsSummary();
  const cases = useCasesSummary();
  const agenda = useSchedulingSummary();

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* Destacada: lo que más importa atender. */}
      <div className="flex flex-col justify-between rounded-3xl bg-primary p-5 text-on-primary">
        <div className="flex items-center justify-between">
          <p className="text-sm opacity-90">Alertas activas</p>
          <Icon name="notifications_active" filled />
        </div>
        <p className="mt-4 text-5xl font-medium tracking-tight">{alerts.data?.active ?? '—'}</p>
        <p className="mt-1 text-sm opacity-90">
          {alerts.data ? `${alerts.data.newToday} nuevas hoy · ${alerts.data.inProgress} en atención` : 'Cargando…'}
        </p>
      </div>

      <div className="flex flex-col justify-between rounded-3xl border border-outline-variant p-5">
        <div className="flex items-center justify-between text-on-surface-variant">
          <p className="text-sm">Próxima cita</p>
          <Icon name="event" />
        </div>
        {agenda.data?.nextAt ? (
          <>
            <p className="mt-4 text-3xl font-medium tracking-tight text-on-surface">{agenda.data.nextCaseFolio}</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {dayAndTime(agenda.data.nextAt)} · {agenda.data.today} citas hoy
            </p>
          </>
        ) : (
          <p className="mt-4 text-on-surface-variant">{agenda.isLoading ? 'Cargando…' : 'Sin citas pendientes hoy'}</p>
        )}
      </div>

      <StatCard
        label={mine ? 'Mis expedientes abiertos' : 'Expedientes por revisar'}
        value={(mine ? cases.data?.mine : cases.data?.needsReview) ?? 0}
        format={INTEGER}
      />
      <StatCard label="Casos de riesgo alto" value={cases.data?.highRisk ?? 0} format={INTEGER} positive="down" />
    </div>
  );
}
