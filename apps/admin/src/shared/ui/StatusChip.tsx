import { useState, type HTMLAttributes, type ReactNode } from 'react';
import './vc-ui.css';

export interface StatusChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Valor del estado: al cambiar, el chip se vuelve a montar y «salta» (`vc-chip--pop`). */
  value: string;
  /** Color por tokens semánticos (`bg-status-success-bg text-status-success`, …). */
  tone: string;
  children: ReactNode;
}

/**
 * Chip de estado: la forma (alto, padding, radio, tipografía) vive en `.vc-chip` para que todos los chips sean
 * idénticos; aquí solo se elige el color. No salta en el primer render, solo cuando `value` cambia.
 */
export function StatusChip({ value, tone, className = '', children, ...rest }: StatusChipProps) {
  const [seen, setSeen] = useState({ value, changes: 0 });
  if (seen.value !== value) setSeen({ value, changes: seen.changes + 1 });

  return (
    <span
      key={seen.changes}
      className={`vc-chip ${seen.changes > 0 ? 'vc-chip--pop' : ''} ${tone} ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
}
