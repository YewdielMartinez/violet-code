import {
  DROGA_LABELS,
  TIPOS_DROGA,
  type AgresorValidationField,
  type TipoDroga,
} from './agresorApi';

const TRI_STATE_OPTIONS: { label: string; value: boolean | null }[] = [
  { label: 'No se sabe', value: null },
  { label: 'No', value: false },
  { label: 'Sí', value: true },
];

export interface ConsumoArmaValues {
  tieneConsumoDroga: boolean | null;
  drogas: TipoDroga[];
  especificacionDroga: string;
  utilizoArmaUObjeto: boolean | null;
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

  function handleArma(next: boolean | null) {
    onPatch(
      next === true
        ? { utilizoArmaUObjeto: true }
        : { utilizoArmaUObjeto: next, especificacionArma: '' },
    );
  }

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Consumo de sustancias
        </legend>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-on-surface">¿Presenta consumo de drogas?</span>
          <div className="flex gap-1.5" role="group" aria-label="Consumo de drogas">
            {TRI_STATE_OPTIONS.map((opt) => {
              const active = values.tieneConsumoDroga === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleConsumo(opt.value)}
                  className={`mk-chip mk-chip--filter ${
                    active ? 'bg-secondary-container text-on-secondary-container' : ''
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {values.tieneConsumoDroga === true ? (
          <div className="grid gap-3 pt-1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TIPOS_DROGA.map((droga) => {
                const checked = values.drogas.includes(droga);
                return (
                  <label
                    key={droga}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                      checked
                        ? 'border-primary bg-primary-container/35 text-on-surface'
                        : 'border-outline-variant bg-surface text-on-surface-variant'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleDroga(droga)}
                      className="accent-primary"
                    />
                    <span>{DROGA_LABELS[droga]}</span>
                  </label>
                );
              })}
            </div>
            {errores.drogas ? <p role="alert" className="text-xs text-status-danger">{errores.drogas}</p> : null}

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
                <p role="alert" className="text-xs text-status-danger">{errores.especificacionDroga}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Uso de arma u objeto
        </legend>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-on-surface">
            ¿Utilizó arma u objeto en la agresión?
          </span>
          <div className="flex gap-1.5" role="group" aria-label="Uso de arma u objeto">
            {TRI_STATE_OPTIONS.map((opt) => {
              const active = values.utilizoArmaUObjeto === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleArma(opt.value)}
                  className={`mk-chip mk-chip--filter ${
                    active ? 'bg-secondary-container text-on-secondary-container' : ''
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {values.utilizoArmaUObjeto === true ? (
          <div className="grid gap-1 pt-1">
            <label className="text-xs font-medium text-on-surface-variant">
              Especificación del arma u objeto
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
              <p role="alert" className="text-xs text-status-danger">{errores.especificacionArma}</p>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <div className="grid gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-on-surface-variant">Observaciones</label>
          <span className="font-mono text-xs text-on-surface-variant">{values.observaciones.length}/5000</span>
        </div>
        <textarea
          rows={3}
          maxLength={5000}
          value={values.observaciones}
          onChange={(e) => onPatch({ observaciones: e.target.value })}
          placeholder="Notas relevantes sobre contexto, antecedentes o señas particulares…"
          className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
        />
        {errores.observaciones ? (
          <p role="alert" className="text-xs text-status-danger">{errores.observaciones}</p>
        ) : null}
      </div>
    </div>
  );
}
