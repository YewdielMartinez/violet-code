import type { TipoDroga } from '@/domain/models/ConsumoDrogas';
import type { AgresorValidationField } from './agresorApi';
import { ConsumoDrogasSelector } from './shared/ConsumoDrogasSelector';

export interface ConsumoArmaValues {
  drogas: TipoDroga[];
  especificacionDroga: string;
  especificacionArma: string;
  observaciones: string;
}

interface Props {
  values: ConsumoArmaValues;
  errores: Partial<Record<AgresorValidationField, string>>;
  onPatch: (patch: Partial<ConsumoArmaValues>) => void;
  surfaceClassName?: string;
  fieldPrefix?: string;
}

export function AgresorConsumoArmaFields({
  values,
  errores,
  onPatch,
  surfaceClassName = 'bg-surface-container-low',
  fieldPrefix = '',
}: Props) {
  const fieldKey = (name: string) => (fieldPrefix ? `${fieldPrefix}${name}` : name);

  return (
    <div className="grid gap-5">
      <fieldset className={`grid gap-4 rounded-2xl border border-outline-variant ${surfaceClassName} p-5`}>
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
          Consumo de sustancias
        </legend>

        <ConsumoDrogasSelector
          drogas={values.drogas}
          especificacionDroga={values.especificacionDroga}
          onChange={onPatch}
          errores={errores}
          fieldPrefix={fieldPrefix}
          label="Consumo de drogas"
        />
      </fieldset>

      <fieldset className={`grid gap-4 rounded-2xl border border-outline-variant ${surfaceClassName} p-5`}>
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
          Uso de arma u objeto
        </legend>

        <div className="grid gap-1">
          <label className="text-sm font-medium text-on-surface-variant">
            Especificación del arma u objeto (opcional)
          </label>
          <label className="mk-field">
            <input
              type="text"
              maxLength={250}
              data-ficha-field={fieldKey('especificacionArma')}
              aria-invalid={errores.especificacionArma ? true : undefined}
              value={values.especificacionArma}
              placeholder="Describe brevemente el objeto o arma"
              onChange={(e) => onPatch({ especificacionArma: e.target.value })}
            />
          </label>
          {errores.especificacionArma ? (
            <p role="alert" className="text-sm text-status-danger">
              {errores.especificacionArma}
            </p>
          ) : null}
        </div>
      </fieldset>

      <div className="grid gap-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-on-surface-variant">Observaciones</label>
          <span className="font-mono text-sm font-medium text-on-surface-variant">
            {values.observaciones.length}/5000
          </span>
        </div>
        <label className="mk-field w-full">
          <textarea
            rows={4}
            maxLength={5000}
            data-ficha-field={fieldKey('observaciones')}
            aria-invalid={errores.observaciones ? true : undefined}
            value={values.observaciones}
            onChange={(e) => onPatch({ observaciones: e.target.value })}
            placeholder="Notas relevantes sobre contexto, antecedentes o señas particulares…"
            className="w-full"
          />
        </label>
        {errores.observaciones ? (
          <p role="alert" className="text-sm text-status-danger">{errores.observaciones}</p>
        ) : null}
      </div>
    </div>
  );
}
