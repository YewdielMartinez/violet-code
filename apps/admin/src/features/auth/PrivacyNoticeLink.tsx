import { Link } from 'react-router-dom';

const CLASS_NAME = 'mk-button mk-button--text mk-button--sm';
const LABEL = 'Aviso de privacidad';

/**
 * Enlace al aviso de privacidad (página completa en /aviso-de-privacidad).
 * `newTab`: se abre en otra pestaña (ancla simple, no requiere router) cuando la persona está a media captura,
 * p. ej. en la ficha, para no perder el formulario. Sin `newTab` navega dentro de la app (login).
 */
export function PrivacyNoticeLink({ newTab = false }: { newTab?: boolean }) {
  if (newTab) {
    return (
      <a href="/aviso-de-privacidad" target="_blank" rel="noopener noreferrer" className={CLASS_NAME}>
        {LABEL}
      </a>
    );
  }
  return (
    <Link to="/aviso-de-privacidad" className={CLASS_NAME}>
      {LABEL}
    </Link>
  );
}
