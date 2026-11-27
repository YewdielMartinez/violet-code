/**
 * Al cerrar el selector de archivos sin elegir nada, el `<input type="file">` emite un evento
 * `cancel` que burbujea. Los `Dialog`/`Drawer` de motion-kit escuchan `cancel` en su `<dialog>`
 * (pensado para Escape) sin revisar el origen, así que ese evento cerraba el diálogo y todos los
 * que lo contienen (p. ej. «Nueva orden» dentro del expediente).
 *
 * Se corta en fase de captura sobre `window`, antes de llegar a cualquier `<dialog>`.
 * Escape sigue funcionando: su `cancel` lo emite el propio `<dialog>`, no un input.
 */
export function installFileInputCancelGuard(target: Window = window): () => void {
  const onCancel = (event: Event) => {
    const el = event.target;
    if (el instanceof HTMLInputElement && el.type === 'file') {
      event.stopPropagation();
    }
  };
  target.addEventListener('cancel', onCancel, true);
  return () => target.removeEventListener('cancel', onCancel, true);
}
