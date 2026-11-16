import { useEffect, useState } from 'react';
import { FadeContent, GlowCard, SlotText } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/fade-content';
import '@yewdiel21/motion-kit/css/components/glow-card';
import '@/shared/ui/slot-text.css';
import { Icon } from '@/shared/ui/Icon';

// Las áreas que coordina el sistema: rotan en el titular (motion-kit SlotText).
const AREAS = ['jurídica', 'psicológica', 'social', 'integral'];

// Cómo funciona, en el orden real del flujo.
const FLOW = [
  { icon: 'sos', title: 'Alerta o solicitud', text: 'Llega desde la app móvil, de forma discreta.' },
  { icon: 'folder_shared', title: 'Expediente único', text: 'La información del caso en un solo lugar, cifrada.' },
  { icon: 'diversity_3', title: 'Atención coordinada', text: 'Cada área registra su intervención.' },
  { icon: 'monitoring', title: 'Indicadores', text: 'Seguimiento por caso, colonia y sindicatura.' },
];

const TRUST = [
  { icon: 'lock', text: 'Acceso restringido' },
  { icon: 'encrypted', text: 'Sesión cifrada' },
  { icon: 'policy', text: 'Actividad auditada' },
];

function useReducedMotion() {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return reduced;
}

function RotatingArea() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % AREAS.length), 3200);
    return () => clearInterval(id);
  }, [reduced]);

  if (reduced) return <span className="text-primary">integral</span>;
  return (
    <span className="text-primary">
      <SlotText text={AREAS[index]} />
    </span>
  );
}

/**
 * Portada institucional. Criterio: minimalista y sobria (proyecto de gobierno):
 * tipografía contenida, superficies neutras y el morado solo en la acción principal y una palabra.
 */
export function LoginHero({ cta }: { cta: React.ReactNode }) {
  return (
    <div className="grid w-full items-center gap-14 lg:grid-cols-2 lg:gap-20">
      <FadeContent as="section" stagger={70} className="max-w-lg">
        <p data-mk-fade-item className="text-sm text-on-surface-variant">
          Secretaría de las Mujeres · Municipio de Ahome
        </p>

        <h1 data-mk-fade-item className="mt-3 text-3xl leading-tight font-medium tracking-tight text-on-surface sm:text-4xl">
          {/* Lectores de pantalla: frase fija; la palabra que rota es decorativa. */}
          <span className="sr-only">Atención integral coordinada en un solo expediente.</span>
          <span aria-hidden>
            Atención <RotatingArea />
            <br />
            coordinada en un solo expediente.
          </span>
        </h1>

        <p data-mk-fade-item className="mt-4 text-on-surface-variant">
          Sistema interno para recibir solicitudes, integrar expedientes y dar seguimiento a cada caso con todo el
          equipo.
        </p>

        <div data-mk-fade-item className="mt-8">
          {cta}
        </div>

        <ul data-mk-fade-item className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-on-surface-variant">
          {TRUST.map((t) => (
            <li key={t.text} className="flex items-center gap-1.5">
              <Icon name={t.icon} className="text-base" />
              {t.text}
            </li>
          ))}
        </ul>
      </FadeContent>

      <section aria-labelledby="como-funciona" className="max-w-lg lg:justify-self-end">
        <h2 id="como-funciona" className="mb-3 text-xs font-medium tracking-wide text-on-surface-variant uppercase">
          Cómo funciona
        </h2>
        {/* Solo el borde se ilumina al acercar el cursor (fill=false): presencia discreta. */}
        <FadeContent as="div" stagger={60} delay={0.15}>
          <GlowCard group fill={false} intensity={0.5} className="grid gap-3 sm:grid-cols-2">
            {FLOW.map((step, i) => (
              <GlowCard key={step.title} as="article" fill={false} data-mk-fade-item>
                <div className="flex items-center justify-between text-on-surface-variant">
                  <Icon name={step.icon} />
                  <span className="font-mono text-xs">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-sm font-medium text-on-surface">{step.title}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{step.text}</p>
              </GlowCard>
            ))}
          </GlowCard>
        </FadeContent>
      </section>
    </div>
  );
}
