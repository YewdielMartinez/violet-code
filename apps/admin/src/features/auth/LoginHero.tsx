import { useEffect, useState } from 'react';
import { FadeContent, GlowCard, SlotText } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/fade-content';
import '@yewdiel21/motion-kit/css/components/glow-card';
import '@/shared/ui/slot-text.css';
import { Icon } from '@/shared/ui/Icon';

// Las áreas que coordina el sistema: rotan en el titular (motion-kit SlotText).
const AREAS = ['jurídica', 'psicológica', 'social', 'integral'];

// Cómo funciona, en el orden real del flujo. Explica el producto sin texto de relleno.
const FLOW = [
  { icon: 'sos', title: 'Alerta o solicitud', text: 'Llega desde la app móvil, de forma discreta, con ubicación si es urgente.' },
  { icon: 'folder_shared', title: 'Expediente único', text: 'Toda la información del caso en un solo lugar, cifrada y con acceso por rol.' },
  { icon: 'diversity_3', title: 'Atención coordinada', text: 'Cada área registra su intervención y ve lo que le corresponde.' },
  { icon: 'monitoring', title: 'Seguimiento e indicadores', text: 'Estado de cada caso y estadísticas por colonia y sindicatura.' },
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
    const id = setInterval(() => setIndex((i) => (i + 1) % AREAS.length), 2600);
    return () => clearInterval(id);
  }, [reduced]);

  if (reduced) return <span className="text-primary">integral</span>;
  return (
    <span className="text-primary">
      <SlotText text={AREAS[index]} />
    </span>
  );
}

export function LoginHero({ cta }: { cta: React.ReactNode }) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
      <FadeContent as="section" stagger={80} className="max-w-xl">
        <p data-mk-fade-item className="text-sm font-medium text-on-surface-variant">
          Secretaría de las Mujeres · Municipio de Ahome
        </p>

        <h1 data-mk-fade-item className="mt-4 text-4xl leading-[1.1] font-semibold tracking-tight text-on-surface sm:text-5xl">
          {/* Lectores de pantalla: frase fija; la palabra que rota es decorativa. */}
          <span className="sr-only">Atención integral coordinada en un solo expediente.</span>
          <span aria-hidden>
            Atención <RotatingArea />
            <br />
            coordinada en un solo expediente.
          </span>
        </h1>

        <p data-mk-fade-item className="mt-5 text-lg text-on-surface-variant">
          Recibe alertas y solicitudes, integra expedientes y da seguimiento a cada caso junto con todo el equipo.
        </p>

        <div data-mk-fade-item className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          {cta}
          <span className="text-sm text-on-surface-variant">Solo personal autorizado</span>
        </div>

        <ul data-mk-fade-item className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-on-surface-variant">
          {TRUST.map((t) => (
            <li key={t.text} className="flex items-center gap-2">
              <Icon name={t.icon} className="text-primary" />
              {t.text}
            </li>
          ))}
        </ul>
      </FadeContent>

      <section aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="mb-4 text-sm font-medium text-on-surface-variant">
          Cómo funciona
        </h2>
        {/* Grupo: la luz sigue al cursor e ilumina los bordes de las tarjetas cercanas. */}
        <FadeContent as="div" stagger={70} delay={0.2}>
          <GlowCard group className="grid gap-3 sm:grid-cols-2" intensity={0.7}>
            {FLOW.map((step, i) => (
              <GlowCard key={step.title} as="article" data-mk-fade-item>
                <div className="flex items-center justify-between">
                  <Icon name={step.icon} className="text-primary" />
                  <span className="font-mono text-xs text-on-surface-variant">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-medium text-on-surface">{step.title}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{step.text}</p>
              </GlowCard>
            ))}
          </GlowCard>
        </FadeContent>
      </section>
    </div>
  );
}
