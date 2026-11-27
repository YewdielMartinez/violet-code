/**
 * Compatibilidad: el aviso de privacidad ya no es un diálogo sino la página `/aviso-de-privacidad`.
 * Este nombre lo importa src/features/expedientes/ficha/FichaIdentidadStep.tsx; allí conviene cambiar el import a
 * `PrivacyNoticeLink` y borrar este archivo. Se abre en otra pestaña para no perder la captura en curso.
 */
import { PrivacyNoticeLink } from './PrivacyNoticeLink';

export function PrivacyNoticeDialog() {
  return <PrivacyNoticeLink newTab />;
}
