import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/shared/ui/Icon';
import type { PrioridadNivel } from '../api';

/** Contenedor común de un widget: título, acción opcional y contenido. */
export function WidgetCard({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: { label: string; to: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-outline-variant bg-surface-container-lowest p-5 ${className}`}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-on-surface">{title}</h2>
        {action ? (
          <Link to={action.to} className="mk-button mk-button--text mk-button--sm">
            {action.label}
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function WidgetLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-2" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-container" />
      ))}
    </div>
  );
}

/**
 * Estado vacío compacto: evita desperdiciar altura con ilustraciones grandes repetidas
 * cuando las bandejas están en cero y mantiene la densidad operativa del Dashboard.
 */
export function WidgetEmpty({
  error,
  title,
  action,
}: {
  error?: boolean;
  title: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/60 px-4 py-4">
      <div className="flex items-center gap-3 text-sm text-on-surface-variant">
        <Icon name={error ? 'error_outline' : 'inbox'} className={error ? 'text-status-danger' : 'text-on-surface-variant'} />
        <span>{error ? 'No se pudo cargar. Verifica tu conexión con Supabase.' : title}</span>
      </div>
      {action && !error ? (
        <Link to={action.to} className="mk-button mk-button--tonal mk-button--sm">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

const PRIORITY: Record<PrioridadNivel, { label: string; className: string }> = {
  alta: { label: 'Prioridad alta', className: 'bg-status-danger-bg text-status-danger' },
  media: { label: 'Prioridad media', className: 'bg-status-warning-bg text-status-warning' },
  baja: { label: 'Prioridad baja', className: 'bg-status-info-bg text-status-info' },
};

const RISK: Record<PrioridadNivel, string> = {
  alta: 'Riesgo alto',
  media: 'Riesgo medio',
  baja: 'Riesgo bajo',
};

/** Prioridad semántica de una alerta o nivel de riesgo de caso. */
export function PriorityBadge({ value, risk = false }: { value: PrioridadNivel; risk?: boolean }) {
  const p = PRIORITY[value];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${p.className}`}>
      {risk ? RISK[value] : p.label}
    </span>
  );
}
