import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Piezas de la barra de acciones de una pantalla (a la derecha de `PageHeader`):
 * píldoras con ícono para vistas/filtros, botones solo-ícono y una acción primaria cuadrada.
 * Mismo alto (36 px) para que se alineen en una sola fila.
 */

const BASE =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl text-sm font-medium ' +
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

/** Clases de una píldora de la barra (para usarlas en `Menu.Trigger` u otros botones nativos). */
export function toolbarPillClass(active = false, extra = ''): string {
  return `${BASE} px-3 ${
    active
      ? 'bg-secondary-container text-on-secondary-container'
      : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
  } ${extra}`.trim();
}

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string;
  /** Resalta la píldora (filtro activo, vista seleccionada). */
  active?: boolean;
  /** Contador pequeño a la derecha (p. ej. filtros aplicados). */
  count?: number;
  children?: ReactNode;
}

/** Píldora con ícono y texto: vistas, filtros, orden. */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton(
  { icon, active = false, count, className = '', children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={props['aria-pressed'] ?? (active || undefined)}
      className={`${BASE} px-3 ${
        active
          ? 'bg-secondary-container text-on-secondary-container'
          : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
      } ${className}`}
      {...props}
    >
      {icon ? <Icon name={icon} className="text-[18px]" /> : null}
      {children}
      {count ? (
        <span className="ml-0.5 min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 text-on-primary">
          {count}
        </span>
      ) : null}
    </button>
  );
});

interface ToolbarIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  /** Obligatorio: nombre accesible del botón. */
  label: string;
  active?: boolean;
}

/** Botón solo-ícono (ajustes de vista, refrescar…). */
export const ToolbarIconButton = forwardRef<HTMLButtonElement, ToolbarIconButtonProps>(function ToolbarIconButton(
  { icon, label, active = false, className = '', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`${BASE} w-9 ${
        active
          ? 'bg-secondary-container text-on-secondary-container'
          : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
      } ${className}`}
      {...props}
    >
      <Icon name={icon} className="text-[20px]" />
    </button>
  );
});

interface ToolbarPrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Nombre accesible; se muestra como texto desde `sm` si `showLabel`. */
  label: string;
  icon?: string;
  showLabel?: boolean;
}

/** Acción principal de la pantalla («+»): cuadrada en móvil, con texto opcional en escritorio. */
export const ToolbarPrimaryButton = forwardRef<HTMLButtonElement, ToolbarPrimaryButtonProps>(
  function ToolbarPrimaryButton({ label, icon = 'add', showLabel = false, className = '', type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={showLabel ? undefined : label}
        title={label}
        className={`${BASE} bg-primary text-on-primary hover:bg-primary/90 ${
          showLabel ? 'w-9 sm:w-auto sm:px-3.5' : 'w-9'
        } ${className}`}
        {...props}
      >
        <Icon name={icon} className="text-[20px]" />
        {showLabel ? <span className="hidden sm:inline">{label}</span> : null}
      </button>
    );
  },
);
