import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
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

export function WidgetEmpty({ error, title }: { error?: boolean; title: string }) {
  return (
    <EmptyState
      illustration={error ? 'error' : 'inbox'}
      title={error ? 'No se pudo cargar' : title}
      description={error ? 'Verifica tu conexión con Supabase.' : undefined}
      loop={false}
    />
  );
}

const PRIORITY: Record<PrioridadNivel, { label: string; className: string }> = {
  alta: { label: 'Alta', className: 'bg-error-container text-on-error-container' },
  media: { label: 'Media', className: 'bg-tertiary-container text-on-tertiary-container' },
  baja: { label: 'Baja', className: 'bg-surface-container-high text-on-surface-variant' },
};

const RISK: Record<PrioridadNivel, string> = {
  alta: 'Riesgo alto',
  media: 'Riesgo medio',
  baja: 'Riesgo bajo',
};

/** Prioridad de una alerta ("Alta") o, con `risk`, nivel de riesgo ("Riesgo alto"). */
export function PriorityBadge({ value, risk = false }: { value: PrioridadNivel; risk?: boolean }) {
  const p = PRIORITY[value];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${p.className}`}>
      {risk ? RISK[value] : p.label}
    </span>
  );
}
