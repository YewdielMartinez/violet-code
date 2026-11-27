import { Icon } from './Icon';
import './vc-ui.css';

export interface SmallEmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  /** Acción tonal opcional (p. ej. «Nueva actividad», «Limpiar filtros»). */
  action?: { label: string; onClick: () => void };
}

/** Estado vacío corto: ícono pequeño + dos líneas (sin ilustraciones grandes). */
export function SmallEmptyState({ icon, title, description, action }: SmallEmptyStateProps) {
  return (
    <div className="vc-empty" role="status">
      <span className="vc-empty__icon" aria-hidden>
        <Icon name={icon} />
      </span>
      <p className="vc-empty__title">{title}</p>
      {description ? <p className="vc-empty__text">{description}</p> : null}
      {action ? (
        <button type="button" className="mk-button mk-button--tonal vc-press" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
