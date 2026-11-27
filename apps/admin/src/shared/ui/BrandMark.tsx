import type { CSSProperties } from 'react';

/**
 * Marca general de la aplicación (SIA-SEMUJERES): isotipo de hojas, cuadrado.
 * `size` es el lado en px. Usa los isotipos oficiales de fondo transparente:
 * - claro: public/logos/app-icon.svg (hoja vino #7A0C31 + rosa #EF6F86);
 * - oscuro: public/logos/app-icon-white-512.png (versión monocromática blanca oficial), legible sobre negro.
 * Se pintan ambos y el CSS (src/index.css) muestra uno según el modo (explícito o "sistema").
 * Es decorativo: el nombre del sistema siempre va al lado como texto (o en el aria-label del botón que lo contiene).
 */
export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  const style = { '--vc-brand-size': `${size}px` } as CSSProperties;
  return (
    <span className={`vc-brand-mark ${className}`.trim()} style={style} aria-hidden>
      <img
        src="/logos/app-icon.svg"
        alt=""
        width={size}
        height={size}
        decoding="async"
        draggable={false}
        className="vc-brand-mark__img vc-brand-mark__img--light"
      />
      <img
        src="/logos/app-icon-white-512.png"
        alt=""
        width={size}
        height={size}
        decoding="async"
        draggable={false}
        className="vc-brand-mark__img vc-brand-mark__img--dark"
      />
    </span>
  );
}

/** Proporción del recorte del logotipo (`public/logo-ahome.png`: 1260 × 408 px, fondo transparente). */
const AHOME_ASPECT = 1260 / 408;

/**
 * Logotipo del Municipio de Ahome. Se usa SOLO en el aviso de privacidad; la marca general es `BrandMark`.
 * `size` es el alto en px; el ancho se deriva de la proporción. La arte oficial es de color: sobre fondos
 * oscuros `.vc-ahome-logo` la muestra en blanco (versión monocromática oficial; ver src/index.css).
 */
export function AhomeLogo({ size = 56, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo-ahome.png"
      alt="Municipio de Ahome"
      width={Math.round(size * AHOME_ASPECT)}
      height={size}
      decoding="async"
      draggable={false}
      className={`vc-ahome-logo ${className}`.trim()}
    />
  );
}
