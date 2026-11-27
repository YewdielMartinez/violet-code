import { Chart } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/chart';
import { useAlertsSummary } from '../api';
import { clamp, useElementBox, useWidgetBox } from './box';
import { Sparkline } from './Sparkline';
import { useWhenVisible } from './useWhenVisible';
import { WidgetCard, WidgetEmpty, WidgetSkeleton } from './shared';

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');

const dayLong = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long' });

/** Alto (px) que ocupan las etiquetas del eje X bajo el área de trazado de la gráfica. */
const X_AXIS = 30;

interface Body {
  days: { date: string; count: number }[];
  closed: number;
}

/**
 * Gráfica de barras. Se monta recién cuando su área es visible y el navegador está libre (la animación de
 * entrada del kit y su pintura son caras en la primera carga); mientras tanto, el esqueleto de gráfica.
 */
function TrendChart({ days, w, fallbackHeight }: { days: Body['days']; w: number; fallbackHeight: number }) {
  const [chartRef, area] = useElementBox<HTMLDivElement>();
  const ready = useWhenVisible(chartRef);
  const plotHeight = clamp((area?.h ?? fallbackHeight) - X_AXIS, 72, 420);

  return (
    <div ref={chartRef} className="min-h-0 min-w-0 flex-1 overflow-hidden">
      {ready ? (
        <Chart
          type="bar"
          label="Alertas recibidas por día"
          labels={days.map((d) => dayLabel(d.date))}
          series={[{ name: 'Alertas', values: days.map((d) => d.count) }]}
          barStyle="pill"
          barWidth={w >= 900 ? 44 : 28}
          axis={plotHeight >= 120}
          height={plotHeight}
        />
      ) : (
        <WidgetSkeleton variant="chart" />
      )}
    </div>
  );
}

function TrendBody({ days, closed }: Body) {
  const { w, h } = useWidgetBox();
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const peak = days.reduce((best, d) => (d.count > best.count ? d : best), days[0]);
  const average = days.length ? Math.round((total / days.length) * 10) / 10 : 0;

  // 1×1: no hay lugar para una gráfica con eje; cifra + minigráfica.
  const tiny = h < 150 && w < 340;
  const side = w >= 520;
  const stacked = !side;

  if (tiny) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div>
          <p className="text-4xl leading-none font-medium tracking-tight text-on-surface tabular-nums">{total}</p>
          <p className="mt-1 truncate text-xs text-on-surface-variant">{closed} cerradas esta semana</p>
        </div>
        <Sparkline values={days.map((d) => d.count)} label="Alertas por día" className="min-h-8 w-full flex-1" />
      </div>
    );
  }

  const stats = (
    <div className={side ? 'flex w-40 shrink-0 flex-col justify-center gap-3' : 'flex shrink-0 items-end gap-4'}>
      <div>
        <p className="text-4xl leading-none font-medium tracking-tight text-on-surface tabular-nums">{total}</p>
        <p className="mt-1 text-xs text-on-surface-variant">alertas en 7 días</p>
      </div>
      {side || h >= 200 || w >= 340 ? (
        <dl className={side ? 'grid gap-2' : 'flex gap-3 text-xs'}>
          <div className="min-w-0">
            <dt className="truncate text-xs text-on-surface-variant">Cerradas</dt>
            <dd className="text-sm font-medium text-on-surface tabular-nums">{closed}</dd>
          </div>
          {side || w >= 420 ? (
            <div className="min-w-0">
              <dt className="truncate text-xs text-on-surface-variant">Promedio diario</dt>
              <dd className="text-sm font-medium text-on-surface tabular-nums">{average}</dd>
            </div>
          ) : null}
          {side && peak && peak.count > 0 ? (
            <div className="min-w-0">
              <dt className="truncate text-xs text-on-surface-variant">Día pico</dt>
              <dd className="truncate text-sm font-medium text-on-surface first-letter:uppercase">
                {dayLong(peak.date)} ({peak.count})
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );

  return (
    <div className={`flex h-full min-h-0 gap-4 ${side ? 'flex-row' : 'flex-col'}`}>
      {stats}
      <TrendChart days={days} w={w} fallbackHeight={h - (stacked ? 64 : 0)} />
    </div>
  );
}

/** Alertas recibidas por día (últimos 7 días), con motion-kit Chart que ocupa el alto disponible. */
export function TrendWidget() {
  const { data, isLoading, isError, refetch } = useAlertsSummary();

  return (
    <WidgetCard title="Alertas de la semana" icon="monitoring">
      {isLoading ? (
        <WidgetSkeleton variant="chart" />
      ) : isError ? (
        <WidgetEmpty error title="" onRetry={() => void refetch()} />
      ) : !data?.byDay.length ? (
        <WidgetEmpty icon="monitoring" title="Sin datos de la semana" description="Aún no hay alertas registradas." />
      ) : (
        <TrendBody days={data.byDay} closed={data.closedThisWeek} />
      )}
    </WidgetCard>
  );
}
