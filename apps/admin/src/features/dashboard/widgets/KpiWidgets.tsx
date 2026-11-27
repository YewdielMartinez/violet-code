import { useAlertsSummary, useCasesSummary, useSchedulingSummary } from '../api';
import { dayAndTime } from './format';
import { KpiTile } from './KpiTile';
import { WidgetCard } from './shared';

/** Alertas activas con la tendencia de 7 días y el contraste «hoy vs ayer» (más alertas = desfavorable). */
export function KpiAlertsWidget() {
  const q = useAlertsSummary(true);
  const days = q.data?.byDay ?? [];
  const today = days[days.length - 1]?.count;
  const yesterday = days[days.length - 2]?.count;

  return (
    <WidgetCard
      title="Alertas pendientes"
      icon="notifications_active"
      action={{ label: 'Ver alertas', to: '/solicitudes' }}
    >
      <KpiTile
        value={q.data?.active}
        loading={q.isLoading}
        error={q.isError}
        onRetry={() => void q.refetch()}
        delta={
          today !== undefined && yesterday !== undefined
            ? { current: today, previous: yesterday, goodWhen: 'down', label: 'hoy vs ayer' }
            : undefined
        }
        secondary={q.data ? `${q.data.newToday} nuevas hoy` : undefined}
        series={days.length > 1 ? { values: days.map((d) => d.count), label: 'Alertas recibidas por día' } : undefined}
        detailsTitle="Estado de las alertas"
        details={
          q.data
            ? [
                { label: 'Nuevas hoy', value: q.data.newToday },
                { label: 'En atención', value: q.data.inProgress },
                { label: 'Cerradas (7 d)', value: q.data.closedThisWeek },
              ]
            : undefined
        }
      />
    </WidgetCard>
  );
}

/** Citas del día y la próxima programada (sin nombres: privacidad operacional). */
export function KpiCitasWidget() {
  const q = useSchedulingSummary(true);
  const next = q.data?.nextAt ? dayAndTime(q.data.nextAt) : null;

  return (
    <WidgetCard title="Citas de hoy" icon="event" action={{ label: 'Abrir agenda', to: '/agenda' }}>
      <KpiTile
        value={q.data?.today}
        loading={q.isLoading}
        error={q.isError}
        onRetry={() => void q.refetch()}
        secondary={next ? `Próxima: ${next}` : q.data ? 'Sin citas próximas' : undefined}
        detailsTitle="Siguiente cita"
        details={
          q.data && next
            ? [
                { label: 'Cuándo', value: next },
                { label: 'Área', value: q.data.nextArea ?? '—' },
              ]
            : undefined
        }
      />
    </WidgetCard>
  );
}

/** Expedientes activos (propios o del área) con proporción en seguimiento. */
export function KpiExpedientesWidget({ userId, mine }: { userId: string; mine: boolean }) {
  const q = useCasesSummary(userId, true);
  const d = q.data;
  const totalActive = d ? d.open + d.inFollowUp : 0;
  const value = d ? (mine ? d.mine : totalActive) : undefined;

  return (
    <WidgetCard
      title={mine ? 'Mis expedientes activos' : 'Expedientes activos'}
      icon="folder_shared"
      action={{ label: 'Ver expedientes', to: '/expedientes' }}
    >
      <KpiTile
        value={value}
        loading={q.isLoading}
        error={q.isError}
        onRetry={() => void q.refetch()}
        secondary={d ? `${d.inFollowUp} en seguimiento` : undefined}
        meter={d && totalActive > 0 ? { value: d.inFollowUp, max: totalActive, label: 'En seguimiento' } : undefined}
        detailsTitle={mine ? 'Todos los expedientes' : undefined}
        details={
          d
            ? [
                { label: 'Abiertos', value: d.open },
                { label: 'En seguimiento', value: d.inFollowUp },
                { label: 'Urgentes', value: d.urgencias },
              ]
            : undefined
        }
      />
    </WidgetCard>
  );
}

/** Casos urgentes (lista de urgencias) y su peso sobre los expedientes activos. */
export function KpiUrgentesWidget({ userId }: { userId: string }) {
  const q = useCasesSummary(userId, true);
  const d = q.data;
  const totalActive = d ? d.open + d.inFollowUp : 0;

  return (
    <WidgetCard title="Casos urgentes" icon="priority_high" action={{ label: 'Ver expedientes', to: '/expedientes' }}>
      <KpiTile
        value={d?.urgencias}
        loading={q.isLoading}
        error={q.isError}
        onRetry={() => void q.refetch()}
        secondary={d ? `de ${totalActive} expedientes activos` : undefined}
        meter={d && totalActive > 0 ? { value: d.urgencias, max: totalActive, label: 'Del total activo' } : undefined}
        detailsTitle="Expedientes activos"
        details={
          d
            ? [
                { label: 'Abiertos', value: d.open },
                { label: 'En seguimiento', value: d.inFollowUp },
                { label: 'Urgentes', value: d.urgencias },
              ]
            : undefined
        }
      />
    </WidgetCard>
  );
}
