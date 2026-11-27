import { Icon } from '@/shared/ui/Icon';
import { useWidgetBox } from './box';
import { Sparkline } from './Sparkline';
import { WidgetEmpty, WidgetSkeleton } from './shared';

export interface KpiDelta {
  current: number;
  previous: number;
  /** Qué sentido es favorable: más citas es bueno ('up'); más alertas, no ('down'). */
  goodWhen: 'up' | 'down';
  /** Con qué se compara («hoy vs ayer»). */
  label: string;
}

export interface KpiTileProps {
  value: number | undefined;
  loading: boolean;
  error: boolean;
  onRetry?: () => void;
  delta?: KpiDelta;
  secondary?: string;
  series?: { values: readonly number[]; label: string };
  detailsTitle?: string;
  details?: readonly { label: string; value: string | number }[];
  meter?: { value: number; max: number; label: string };
}

const fmt = (n: number) => n.toLocaleString('es-MX');

/** Diferencia con signo y su lectura accesible. Sin cambio no es ni bueno ni malo. */
export function describeDelta(delta: KpiDelta) {
  const diff = delta.current - delta.previous;
  const good = diff === 0 ? null : diff > 0 === (delta.goodWhen === 'up');
  const text = diff === 0 ? 'Sin cambio' : `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}`;
  const spoken =
    diff === 0
      ? `Sin cambio ${delta.label}`
      : `${fmt(Math.abs(diff))} ${diff > 0 ? 'más' : 'menos'}, ${delta.label}`;
  return { diff, good, text, spoken };
}

function DeltaChip({ delta }: { delta: KpiDelta }) {
  const { diff, good, text, spoken } = describeDelta(delta);
  const tone =
    good === null
      ? 'bg-surface-container text-on-surface-variant'
      : good
        ? 'bg-status-success-bg text-status-success'
        : 'bg-status-warning-bg text-status-warning';
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-on-surface-variant">
      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium tabular-nums ${tone}`}>
        {diff !== 0 ? <Icon name={diff > 0 ? 'north_east' : 'south_east'} className="text-[14px]" /> : null}
        <span aria-hidden>{text}</span>
      </span>
      <span aria-hidden>{delta.label}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs text-on-surface-variant">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 overflow-hidden rounded-full bg-surface-container-high"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Cifra principal con contexto que crece con la celda:
 * - 1×1: cifra + variación.
 * - 2×1: la minigráfica ocupa el ancho sobrante, junto a la cifra.
 * - Alto (1×2, 2×2…): minigráfica que rellena el alto + barra de proporción + desglose.
 * - Banda (4×1): el desglose pasa a una fila a la derecha.
 */
export function KpiTile({
  value,
  loading,
  error,
  onRetry,
  delta,
  secondary,
  series,
  detailsTitle,
  details,
  meter,
}: KpiTileProps) {
  const { w, h } = useWidgetBox();

  if (error) return <WidgetEmpty error onRetry={onRetry} title="No se pudo cargar" />;
  if (loading || value === undefined) return <WidgetSkeleton variant="kpi" />;

  const roomy = h >= 190;
  const wide = w >= 400;
  const band = !roomy && w >= 760;
  const showSeries = Boolean(series) && (roomy || wide);
  const showDetails = Boolean(details?.length) && (roomy || band);
  const threeCols = band || w >= 420;

  const figure = (
    <div className="shrink-0">
      <p
        className={`leading-none font-medium tracking-tight text-on-surface tabular-nums ${roomy || wide ? 'text-5xl' : 'text-4xl'}`}
      >
        {fmt(value)}
      </p>
      <div className="mt-2 grid gap-1">
        {delta ? <DeltaChip delta={delta} /> : null}
        {secondary && (h >= 110 || !delta) ? (
          <p className="truncate text-sm text-on-surface-variant">{secondary}</p>
        ) : null}
      </div>
    </div>
  );

  const detailList = showDetails ? (
    <div className={band ? 'min-w-0 flex-1' : ''}>
      {detailsTitle ? <p className="mb-1 text-xs font-medium text-on-surface-variant">{detailsTitle}</p> : null}
      <dl className={`grid gap-2 ${threeCols ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {details?.map((d) => (
          <div
            key={d.label}
            className={`min-w-0 rounded-2xl bg-surface-container-low px-3 py-2 ${threeCols ? '' : 'flex items-baseline justify-between gap-2'}`}
          >
            <dt className="truncate text-xs text-on-surface-variant">{d.label}</dt>
            <dd className="truncate text-base font-medium text-on-surface tabular-nums">{d.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className={`flex min-h-0 gap-4 ${band ? 'items-center' : 'items-end'}`}>
        {figure}
        {series && showSeries && !roomy ? (
          <Sparkline values={series.values} label={series.label} className="h-16 min-w-0 flex-1" />
        ) : null}
        {band ? detailList : null}
      </div>
      {series && showSeries && roomy ? (
        <Sparkline values={series.values} label={series.label} className="min-h-12 w-full flex-1" />
      ) : (
        <div className="flex-1" />
      )}
      {meter && roomy ? <Meter {...meter} /> : null}
      {!band ? detailList : null}
    </div>
  );
}
