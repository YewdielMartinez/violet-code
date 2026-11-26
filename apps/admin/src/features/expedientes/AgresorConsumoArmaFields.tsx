import { Icon } from '@/shared/ui/Icon';
import {
  DROGA_LABELS,
  TIPOS_DROGA,
  type AgresorValidationField,
  type TipoDroga,
} from './agresorApi';
import { AnimatedReveal } from './agresor/AnimatedReveal';
import { AgresorRadioGroup } from './agresor/motionCompat';

const TRI_STATE_ITEMS = [
  { value: 'desconocido', label: 'No se sabe' },
  { value: 'no', label: 'No' },
  { value: 'si', label: 'Sí' },
];

function boolToTriState(value: boolean | null): 'si' | 'no' | 'desconocido' {
  if (value === true) return 'si';
  if (value === false) return 'no';
  return 'desconocido';
}

function triStateToBool(value: string | null): boolean | null {
  if (value === 'si') return true;
  if (value === 'no') return false;
  return null;
}

export interface ConsumoArmaValues {
  tieneConsumoDroga: boolean | null;
  drogas: TipoDroga[];
  especificacionDroga: string;
  especificacionArma: string;
  observaciones: string;
}

interface Props {
  values: ConsumoArmaValues;
  errores: Partial<Record<AgresorValidationField, string>>;
  onPatch: (patch: Partial<ConsumoArmaValues>) => void;
}

export function AgresorConsumoArmaFields({ values, errores, onPatch }: Props) {
  function handleConsumo(next: boolean | null) {
    onPatch(
      next === true
        ? { tieneConsumoDroga: true }
        : { tieneConsumoDroga: next, drogas: [], especificacionDroga: '' },
    );
  }

  function handleToggleDroga(droga: TipoDroga) {
    const next = values.drogas.includes(droga)
      ? values.drogas.filter((item) => item !== droga)
      : [...values.drogas, droga];
    onPatch({ drogas: next });
  }

  const consumoActivo = values.tieneConsumoDroga === true;

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Consumo de sustancias
        </legend>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium text-on-surface">¿Presenta consumo de drogas?</span>
          <AgresorRadioGroup
            variant="pill"
            label="¿Presenta consumo de drogas?"
            items={TRI_STATE_ITEMS}
            value={boolToTriState(values.tieneConsumoDroga)}
            onChange={(val) => handleConsumo(triStateToBool(val))}
          />
        </div>

        <AnimatedReveal show={consumoActivo}>
          <div className="grid gap-3 pt-1">
            <span className="text-xs font-medium text-on-surface-variant">
              Sustancias detectadas (selecciona una o más)
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Tipos de drogas">
              {TIPOS_DROGA.map((droga) => {
                const checked = values.drogas.includes(droga);
                return (
                  <button
                    key={droga}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => handleToggleDroga(droga)}
                    className="mk-chip mk-chip--filter transition-transform duration-150 active:scale-95 motion-reduce:transition-none"
                  >
                    <Icon name={checked ? 'check' : 'add'} className="text-[16px]" />
                    <span>{DROGA_LABELS[droga]}</span>
                  </button>
                );
              })}
            </div>
            {errores.drogas ? (
              <p role="alert" className="text-xs text-status-danger">{errores.drogas}</p>
            ) : null}

            <div className="grid gap-1">
              <label className="text-xs font-medium text-on-surface-variant">
                Especificación de droga (opcional)
              </label>
              <label className="mk-field">
                <input
                  type="text"
                  maxLength={250}
                  value={values.especificacionDroga}
                  placeholder="Ej. frecuencia o sustancia adicional"
                  onChange={(e) => onPatch({ especificacionDroga: e.target.value })}
                />
              </label>
              {errores.especificacionDroga ? (
                <p role="alert" className="text-xs text-status-danger">
                  {errores.especificacionDroga}
                </p>
              ) : null}
            </div>
          </div>
        </AnimatedReveal>
      </fieldset>

      <fieldset className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Uso de arma u objeto
        </legend>

        <div className="grid gap-1">
          <label className="text-xs font-medium text-on-surface-variant">
            Especificación del arma u objeto (opcional)
          </label>
          <label className="mk-field">
            <input
              type="text"
              maxLength={250}
              value={values.especificacionArma}
              placeholder="Describe brevemente el objeto o arma"
              onChange={(e) => onPatch({ especificacionArma: e.target.value })}
            />
          </label>
          {errores.especificacionArma ? (
            <p role="alert" className="text-xs text-status-danger">
              {errores.especificacionArma}
            </p>
          ) : null}
        </div>
      </fieldset>

      <div className="grid gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-on-surface-variant">Observaciones</label>
          <span className="font-mono text-xs text-on-surface-variant">
            {values.observaciones.length}/5000
          </span>
        </div>
        <label className="mk-field w-full">
          <textarea
            rows={3}
            maxLength={5000}
            value={values.observaciones}
            onChange={(e) => onPatch({ observaciones: e.target.value })}
            placeholder="Notas relevantes sobre contexto, antecedentes o señas particulares…"
            className="w-full"
          />
        </label>
        {errores.observaciones ? (
          <p role="alert" className="text-xs text-status-danger">{errores.observaciones}</p>
        ) : null}
      </div>
    </div>
  );
}
