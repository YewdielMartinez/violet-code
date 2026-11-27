import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@/shared/ui/Icon';
import { AhomeLogo } from '@/shared/ui/BrandMark';
import { useDocumentTitle } from '@/shared/ui/PageHeader';
import { ThemeToggleButton } from '@/shared/ui/ThemeToggleButton';

const SECTIONS = [
  {
    heading: 'Finalidad del tratamiento',
    body: (
      <p>
        Los datos personales tratados en este sistema se usan exclusivamente para brindar atención, orientación y
        seguimiento a las personas usuarias de la Secretaría de las Mujeres, y para generar estadísticas agregadas que
        no permiten identificar a nadie.
      </p>
    ),
  },
  {
    heading: 'Acceso y seguridad',
    body: (
      <p>
        El acceso está restringido al personal autorizado. Cada consulta y cambio queda registrado en una bitácora de
        auditoría. La información se transmite cifrada.
      </p>
    ),
  },
  {
    heading: 'Datos del prototipo',
    body: (
      <p>
        Durante el hackathon, el sistema funciona únicamente con <strong>datos sintéticos</strong>.
      </p>
    ),
  },
];

/**
 * Aviso de privacidad (BORRADOR) a pantalla completa. Ruta pública: se abre desde el encabezado del login.
 * El texto definitivo debe validarlo el área jurídica de SEMUJERES (Q-47).
 */
export default function PrivacyNoticePage() {
  useDocumentTitle('Aviso de privacidad');
  const navigate = useNavigate();
  const location = useLocation();

  // "default" = primera entrada del historial en esta pestaña: no hay "atrás" dentro de la app.
  const goBack = () => (location.key === 'default' ? navigate('/login', { replace: true }) : navigate(-1));

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
        <button type="button" className="mk-button mk-button--text mk-button--sm inline-flex items-center gap-2" onClick={goBack}>
          <Icon name="arrow_back" className="text-[18px]" />
          <span>Volver</span>
        </button>
        <ThemeToggleButton variant="header" />
      </header>

      <main className="mx-auto w-full max-w-[70ch] flex-1 px-6 pt-4 pb-16 sm:px-10">
        <div className="vc-privacy-enter" style={{ '--vc-i': 0 } as React.CSSProperties}>
          <AhomeLogo size={56} />
          <h1 className="mt-10 text-4xl font-semibold tracking-tight text-on-surface sm:text-5xl">Aviso de privacidad</h1>
          <p className="mt-3 text-base text-on-surface-variant">Versión simplificada</p>
        </div>

        <p
          className="vc-privacy-enter mt-8 rounded-2xl bg-tertiary-container px-4 py-3 text-sm text-on-tertiary-container"
          style={{ '--vc-i': 1 } as React.CSSProperties}
        >
          Borrador para el prototipo. Pendiente de validación jurídica.
        </p>

        <div className="mt-10 grid gap-8">
          {SECTIONS.map((section, i) => (
            <section
              key={section.heading}
              className="vc-privacy-enter grid gap-2 text-base leading-relaxed text-on-surface-variant"
              style={{ '--vc-i': i + 2 } as React.CSSProperties}
            >
              <h2 className="text-xl font-semibold text-on-surface">{section.heading}</h2>
              {section.body}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
