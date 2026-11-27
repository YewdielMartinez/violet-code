import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/shared/ui/Icon';
import type { PrioridadNivel } from '../api';
import { useElementBox, useWidgetBox, useWidgetSize, WidgetBoxProvider, type WidgetBox } from './box';

interface WidgetCardProps {
  title: string;
  /** Línea corta bajo el título (conteo, contexto). */
  subtitle?: string;
  /** Ícono (Material Symbols) junto al título. */
  icon?: string;
  action?: { label: string; to: string };
  children: ReactNode | ((box: WidgetBox) => ReactNode);
}

/**
 * Chrome común de todos los widgets: misma tarjeta (radio, borde, relleno), mismo encabezado
 * (ícono + título + subtítulo + acción) y un cuerpo que se mide para que cada widget llene su celda.
 * El contenedor `@container` permite que el contenido reaccione al ancho real de la celda.
 */
export function WidgetCard({ title, subtitle, icon, action, children }: WidgetCardProps) {
  const size = useWidgetSize();
  const [bodyRef, measured] = useElementBox<HTMLDivElement>();
  const estimate = useWidgetBox();
  const box: WidgetBox = measured ? { w: measured.w, h: measured.h, size, measured: true } : estimate;

  return (
    <section
      aria-label={title}
      className="@container flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest p-4 @sm:p-5"
    >
      <header className="mb-3 flex min-h-8 items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? (
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary-container text-on-secondary-container"
            >
              <Icon name={icon} className="text-[18px]" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-base leading-tight font-medium text-on-surface">{title}</h2>
            {subtitle ? <p className="truncate text-xs text-on-surface-variant">{subtitle}</p> : null}
          </div>
        </div>
        {action ? (
          <Link
            to={action.to}
            aria-label={action.label}
            title={action.label}
            className="mk-button mk-button--text mk-button--sm shrink-0"
          >
            <span className="hidden @sm:inline">{action.label}</span>
            <Icon name="north_east" className="text-[18px] @sm:ml-1" />
          </Link>
        ) : null}
      </header>
      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <WidgetBoxProvider value={box}>{typeof children === 'function' ? children(box) : children}</WidgetBoxProvider>
      </div>
    </section>
  );
}

export type SkeletonVariant = 'kpi' | 'list' | 'chart';

const BONE = 'rounded-2xl bg-surface-container motion-safe:animate-pulse';

/** Esqueleto con la forma del contenido real de cada tipo de widget. */
export function WidgetSkeleton({ variant = 'list' }: { variant?: SkeletonVariant }) {
  const { h } = useWidgetBox();
  const rows = Math.max(1, Math.min(6, Math.floor(h / 56)));
  return (
    <div role="status" aria-busy="true" aria-label="Cargando" className="flex h-full min-h-0 flex-col gap-3">
      {variant === 'kpi' ? (
        <>
          <div className={`${BONE} h-10 w-24`} />
          <div className={`${BONE} h-4 w-32`} />
          <div className={`${BONE} min-h-8 flex-1`} />
        </>
      ) : variant === 'chart' ? (
        <>
          <div className={`${BONE} h-8 w-20`} />
          <div className="flex min-h-12 flex-1 items-end gap-2">
            {[40, 65, 50, 85, 60, 75, 45].map((height, i) => (
              <div key={i} className={`${BONE} flex-1`} style={{ height: `${height}%` }} />
            ))}
          </div>
        </>
      ) : (
        Array.from({ length: rows }, (_, i) => <div key={i} className={`${BONE} h-12 shrink-0`} />)
      )}
    </div>
  );
}

interface WidgetEmptyProps {
  error?: boolean;
  title: string;
  /** Segunda línea (qué hacer). */
  description?: string;
  icon?: string;
  action?: { label: string; to: string };
  onRetry?: () => void;
}

/**
 * Vacío/error compacto: ícono + dos líneas, centrado en el espacio del widget.
 * En celdas muy bajas pasa a una sola fila para no desbordar.
 */
export function WidgetEmpty({ error, title, description, icon, action, onRetry }: WidgetEmptyProps) {
  const { h } = useWidgetBox();
  const compact = h < 96;
  const line1 = error ? 'No se pudo cargar' : title;
  const line2 = error ? 'Verifica tu conexión e inténtalo de nuevo.' : description;
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`flex h-full min-h-0 items-center justify-center gap-3 text-center ${compact ? 'flex-row text-left' : 'flex-col'}`}
    >
      <span
        aria-hidden
        className={`grid size-10 shrink-0 place-items-center rounded-full ${
          error ? 'bg-status-danger-bg text-status-danger' : 'bg-secondary-container text-on-secondary-container'
        }`}
      >
        <Icon name={error ? 'error_outline' : (icon ?? 'inbox')} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-on-surface">{line1}</p>
        {line2 && !compact ? <p className="mx-auto max-w-[26ch] text-xs text-on-surface-variant">{line2}</p> : null}
        {!compact && error && onRetry ? (
          <button type="button" className="mk-button mk-button--tonal mk-button--sm mt-2" onClick={onRetry}>
            Reintentar
          </button>
        ) : null}
        {!compact && !error && action ? (
          <Link to={action.to} className="mk-button mk-button--tonal mk-button--sm mt-2">
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

const PRIORITY: Record<PrioridadNivel, { label: string; short: string; className: string }> = {
  alta: { label: 'Prioridad alta', short: 'Alta', className: 'bg-status-danger-bg text-status-danger' },
  media: { label: 'Prioridad media', short: 'Media', className: 'bg-status-warning-bg text-status-warning' },
  baja: { label: 'Prioridad baja', short: 'Baja', className: 'bg-status-info-bg text-status-info' },
};

/** Prioridad semántica de una alerta (texto siempre visible, no solo color). */
export function PriorityBadge({ value, short = false }: { value: PrioridadNivel; short?: boolean }) {
  const p = PRIORITY[value];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${p.className}`}
      title={p.label}
    >
      {short ? p.short : p.label}
    </span>
  );
}
