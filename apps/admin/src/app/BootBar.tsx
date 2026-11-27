/**
 * Barra de carga fija en el borde superior mientras llegan los chunks de la ruta.
 * Los estilos (boot.css, clase `vc-boot`) van en el CSS de entrada para que el MISMO elemento pueda pintarse
 * antes de que cargue cualquier JS y siga visible cuando React toma el control de #root (sin saltos:
 * es `position: fixed`, no ocupa espacio en el flujo).
 * `late`: aparece tras ~150 ms, para que una navegación interna con el chunk ya precargado no parpadee.
 */
export function BootBar({ late = false }: { late?: boolean }) {
  return <div className={late ? 'vc-boot vc-boot--late' : 'vc-boot'} role="progressbar" aria-label="Cargando" />;
}
