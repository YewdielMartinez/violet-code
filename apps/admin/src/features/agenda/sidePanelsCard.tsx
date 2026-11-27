import { useId, useState, type ReactNode } from 'react';
import { Icon } from '@/shared/ui/Icon';
import './sidePanels.css';

export interface SidePanelCardProps {
  title: string;
  /** Una línea que explica para qué sirve el panel. */
  subtitle?: string;
  icon: string;
  /** Contador del encabezado (se oculta si es `undefined`). */
  count?: number;
  /** Texto accesible del contador, p. ej. «3 por confirmar». */
  countLabel?: (count: number) => string;
  /** Ayuda al pasar el cursor sobre el título (p. ej. el día de las citas). */
  titleHint?: string;
  defaultOpen?: boolean;
  /** Define el acento visual (`sp-card--confirmar`, `sp-card--urgencias`). */
  className?: string;
  children: ReactNode;
}

/** Tarjeta colapsable (altura animada con `grid-template-rows`, sin medir el DOM). */
export function SidePanelCard({
  title,
  subtitle,
  icon,
  count,
  countLabel = (n) => `${n} ${n === 1 ? 'pendiente' : 'pendientes'}`,
  titleHint,
  defaultOpen = true,
  className = '',
  children,
}: SidePanelCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section className={`sp-card ${className}`} data-open={open} aria-label={title}>
      <h3 className="sp-card__heading">
        <button
          type="button"
          className="sp-card__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sp-card__icon" aria-hidden>
            <Icon name={icon} />
          </span>
          <span className="sp-card__titles">
            <span className="sp-card__title" title={titleHint}>
              {title}
            </span>
            {subtitle ? <span className="sp-card__subtitle">{subtitle}</span> : null}
          </span>
          {count !== undefined ? (
            <span className="sp-badge" data-zero={count === 0 ? '' : undefined} aria-label={countLabel(count)}>
              {count}
            </span>
          ) : null}
          <span className="sp-card__chevron" aria-hidden>
            <Icon name="expand_more" />
          </span>
        </button>
      </h3>
      <div id={bodyId} className="sp-card__body" inert={!open}>
        <div className="sp-card__inner">{children}</div>
      </div>
    </section>
  );
}

/** Filas de carga con shimmer (respeta `prefers-reduced-motion` desde el CSS). */
export function SidePanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="sp-skeleton" role="status" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sp-skeleton__row" />
      ))}
    </div>
  );
}

export interface SidePanelEmptyProps {
  icon: string;
  title: string;
  description?: string;
}

/** Estado vacío corto: ícono pequeño + dos líneas (sin ilustraciones grandes). */
export function SidePanelEmpty({ icon, title, description }: SidePanelEmptyProps) {
  return (
    <div className="sp-empty" role="status">
      <span className="sp-empty__icon" aria-hidden>
        <Icon name={icon} />
      </span>
      <p className="sp-empty__title">{title}</p>
      {description ? <p className="sp-empty__text">{description}</p> : null}
    </div>
  );
}

/** Error compacto con reintento. */
export function SidePanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="sp-empty sp-empty--error" role="alert">
      <span className="sp-empty__icon" aria-hidden>
        <Icon name="error" />
      </span>
      <p className="sp-empty__title">No se pudo cargar</p>
      <p className="sp-empty__text">{message}</p>
      <button type="button" className="sp-act sp-act--tonal" onClick={onRetry}>
        <Icon name="refresh" />
        <span>Reintentar</span>
      </button>
    </div>
  );
}
