import { StatCard } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/stat-card';
import { Icon } from '@/shared/ui/Icon';
import { useAlertsSummary, useCasesSummary, useSchedulingSummary } from '../api';
import { dayAndTime } from './format';

// Conteos: siempre enteros (también mientras StatCard anima el número).
const INTEGER = { maximumFractionDigits: 0 };

interface Props {
  userId: string;
  mine: boolean;
  canViewAlerts: boolean;
  canViewCases: boolean;
}

/** Resumen del día adaptado a permisos reales por RLS. */
export function KpisWidget({ userId, mine, canViewAlerts, canViewCases }: Props) {
  const alerts = useAlertsSummary(canViewAlerts);
  const cases = useCasesSummary(userId, canViewCases);
  const agenda = useSchedulingSummary(true);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {canViewAlerts && (
        <div className="flex flex-col justify-between rounded-3xl bg-primary p-5 text-on-primary">
          <div className="flex items-center justify-between">
            <p className="text-sm opacity-90">Alertas activas</p>
            <Icon name="notifications_active" filled />
          </div>
          <p className="mt-4 text-5xl font-medium tracking-tight">{alerts.data?.active ?? '—'}</p>
          <p className="mt-1 text-sm opacity-90">
            {alerts.data ? `${alerts.data.newToday} nuevas hoy · ${alerts.data.inProgress} tomadas` : 'Cargando…'}
          </p>
        </div>
      )}

      <div className="flex flex-col justify-between rounded-3xl border border-outline-variant p-5">
        <div className="flex items-center justify-between text-on-surface-variant">
          <p className="text-sm">Próxima cita</p>
          <Icon name="event" />
        </div>
        {agenda.data?.nextAt ? (
          <>
            <p className="mt-4 truncate text-2xl font-medium tracking-tight text-on-surface">
              {agenda.data.nextUsuaria ?? 'Usuaria'}
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {dayAndTime(agenda.data.nextAt)} · {agenda.data.nextArea ?? 'Área'} · {agenda.data.today} hoy
            </p>
          </>
        ) : (
          <p className="mt-4 text-on-surface-variant">
            {agenda.isLoading ? 'Cargando…' : 'Sin citas próximas programadas'}
          </p>
        )}
      </div>

      {canViewCases && (
        <>
          <StatCard
            label={mine ? 'Mis expedientes activos' : 'Expedientes abiertos / seguimiento'}
            value={(mine ? cases.data?.mine : (cases.data?.open ?? 0) + (cases.data?.inFollowUp ?? 0)) ?? 0}
            format={INTEGER}
          />
          <StatCard label="En lista de urgencias" value={cases.data?.urgencias ?? 0} format={INTEGER} positive="down" />
        </>
      )}
    </div>
  );
}
