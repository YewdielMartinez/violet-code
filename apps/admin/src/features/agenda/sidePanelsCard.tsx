import { Icon } from '@/shared/ui/Icon';
import './sidePanels.css';

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
