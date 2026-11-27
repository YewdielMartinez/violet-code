import { memo } from 'react';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { ExpedientePrioridadControl } from './ExpedientePrioridadControl';
import { calculateAge, formatFechaNacimiento, formatSexo } from './formatters';

interface Props {
  expediente: ExpedienteResumen;
}

/** Tarjeta compacta con la identidad básica de la usuaria. */
export const ExpedienteHeroCard = memo(function ExpedienteHeroCard({ expediente }: Props) {
  const age = calculateAge(expediente.persona.fechaNacimiento);

  return (
    <section
      aria-label="Resumen de la usuaria"
      className="rounded-2xl border border-outline-variant bg-surface-container-low px-5 py-4 text-on-surface"
    >
      <h3 className="text-2xl font-semibold leading-snug tracking-tight text-on-surface sm:text-[1.65rem]">
        {expediente.persona.nombreCompleto}
      </h3>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-base text-on-surface-variant">
        <span className="rounded-full bg-primary-container px-3 py-0.5 font-mono text-sm font-semibold text-on-primary-container">
          {expediente.folio}
        </span>
        <span>{formatSexo(expediente.persona.sexo)}</span>
        <span>{age !== null ? `${age} años` : 'Edad sin registrar'}</span>
        <span>{formatFechaNacimiento(expediente.persona.fechaNacimiento)}</span>
        <ExpedientePrioridadControl fichaId={expediente.id} estado={expediente.estado} />
      </div>
    </section>
  );
});
