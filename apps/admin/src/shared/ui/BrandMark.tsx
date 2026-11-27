/** Proporción del recorte del logotipo (`public/logo-ahome.png`: 1260 × 408 px, fondo transparente). */
const LOGO_ASPECT = 1260 / 408;

/**
 * Logotipo institucional «Ahome» (sin lema).
 * `size` es el alto en px; el ancho se deriva de la proporción para no deformarlo.
 */
export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo-ahome.png"
      alt="Ahome"
      width={Math.round(size * LOGO_ASPECT)}
      height={size}
      decoding="async"
      draggable={false}
      className={`block h-auto max-w-full object-contain ${className}`.trim()}
      style={{ height: size, width: 'auto' }}
    />
  );
}

/** Nombre del sistema con tipografía institucional (Montserrat: geométrica, afín al logotipo). */
export function BrandName({ size = 13, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "'Montserrat', 'DM Sans', system-ui, sans-serif",
        fontSize: size,
        fontWeight: 600,
        letterSpacing: '0.16em',
        lineHeight: 1.2,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      SIA-SEMUJERES
    </span>
  );
}
