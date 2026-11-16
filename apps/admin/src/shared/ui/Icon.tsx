/**
 * Ícono de Material Symbols Rounded (la fuente que carga motion-kit). Decorativo: aria-hidden.
 * Nombres: https://fonts.google.com/icons
 */
export function Icon({ name, filled = false, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span aria-hidden className={`mk-icon ${filled ? 'mk-icon--fill' : ''} ${className}`}>
      {name}
    </span>
  );
}
