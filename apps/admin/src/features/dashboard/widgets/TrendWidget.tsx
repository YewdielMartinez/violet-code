import { Chart } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/chart';
import { useAlertsSummary } from '../api';
import { WidgetCard, WidgetEmpty, WidgetLoading } from './shared';

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');

/** Alertas recibidas por día (últimos 7 días), con motion-kit Chart. */
export function TrendWidget() {
  const { data, isLoading, isError } = useAlertsSummary();
  const total = data?.byDay.reduce((sum, d) => sum + d.count, 0) ?? 0;

  return (
    <WidgetCard title="Alertas de la semana">
      {isLoading ? (
        <WidgetLoading rows={2} />
      ) : isError || !data ? (
        <WidgetEmpty error={isError} title="Sin datos" />
      ) : (
        <>
          <p className="text-3xl font-medium tracking-tight text-on-surface">{total}</p>
          <p className="mb-3 text-sm text-on-surface-variant">{data.closedThisWeek} cerradas esta semana</p>
          <Chart
            type="bar"
            label="Alertas recibidas por día"
            labels={data.byDay.map((d) => dayLabel(d.date))}
            series={[{ name: 'Alertas', values: data.byDay.map((d) => d.count) }]}
            barStyle="pill"
            height={160}
          />
        </>
      )}
    </WidgetCard>
  );
}
