import { memo } from 'react';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { calculateAge, formatFechaNacimiento, formatSexo } from './formatters';

interface Props {
  expediente: ExpedienteResumen;
}

/** Tarjeta protagonista con el color primario del tema e identidad básica de la usuaria. */
export const ExpedienteHeroCard = memo(function ExpedienteHeroCard({ expediente }: Props) {
  const age = calculateAge(expediente.persona.fechaNacimiento);

  return (
    <section
      aria-label="Resumen de la usuaria"
      className="rounded-3xl bg-primary p-6 text-on-primary sm:p-7"
    >
      <h3
       
        className="text-3xl font-medium leading-tight tracking-tight text-on-primary sm:text-4xl"
      >
        {expediente.persona.nombreCompleto}
      </h3>

      <div className="mt-4 grid gap-1 text-sm text-on-primary/90">
        <p className="font-mono text-sm font-medium tracking-wide text-on-primary">
          <span>{expediente.folio}</span>
        </p>
        <p>{formatSexo(expediente.persona.sexo)}</p>
        <p>{age !== null ? `${age} años` : 'Edad sin registrar'}</p>
        <p>{formatFechaNacimiento(expediente.persona.fechaNacimiento)}</p>
      </div>
    </section>
  );
});
