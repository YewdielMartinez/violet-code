/** Proporción del recorte del logotipo (`public/logo-ahome.png`: 1260 × 408 px, fondo transparente). */
const LOGO_ASPECT = 1260 / 408;

/**
 * Logotipo institucional «Ahome» (sin lema).
 * `size` es el alto en px; el ancho se deriva de la proporción para no deformarlo.
 */
export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="SIA-SEMUJERES" className={className}>
      <rect width="40" height="40" rx="11" style={{ fill: 'var(--md-sys-color-primary)' }} />
      <path
        d="M12 16.5 L20 29.5 L28 16.5"
        fill="none"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: 'var(--md-sys-color-on-primary)' }}
      />
      <circle cx="20" cy="10.5" r="3.1" style={{ fill: 'var(--md-sys-color-on-primary)' }} />
    </svg>
  );
}
