import { useId } from 'react';
import {
  DROGA_LABELS,
  ESPECIFICACION_DROGA_MAX,
  OPCIONES_CONSUMO_DROGA,
  requiereEspecificacionDroga,
  toggleDroga,
  type TipoDroga,
} from '@/domain/models/ConsumoDrogas';
import { Icon } from '@/shared/ui/Icon';

export interface ConsumoDrogasValues {
  drogas: TipoDroga[];
  especificacionDroga: string;
}

interface Props extends ConsumoDrogasValues {
  onChange: (patch: Partial<ConsumoDrogasValues>) => void;
  errores?: { drogas?: string; especificacionDroga?: string };
  /** Prefijo de `data-ficha-field` para enfocar el campo con error en wizards. */
  fieldPrefix?: string;
  label?: string;
}

/**
 * Selector de consumo de drogas compartido por persona usuaria y persona agresora.
 * Selección múltiple, OPCIONAL (sin asterisco; vacío = sin dato). «No consume» es
 * excluyente con las demás sustancias y «Otra» habilita una especificación opcional.
 */
export function ConsumoDrogasSelector({
  drogas,
  especificacionDroga,
  onChange,
  errores = {},
  fieldPrefix = '',
  label = 'Consumo de drogas',
}: Props) {
  const labelId = useId();
  const fieldKey = (name: string) => (fieldPrefix ? `${fieldPrefix}${name}` : name);

  function handleToggle(droga: TipoDroga) {
    const next = toggleDroga(drogas, droga);
    onChange(
      requiereEspecificacionDroga(next)
        ? { drogas: next }
        : { drogas: next, especificacionDroga: '' },
    );
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-0.5">
        <span id={labelId} className="text-sm font-medium text-on-surface">
          {label} <span className="font-normal text-on-surface-variant">(opcional)</span>
        </span>
        <span className="text-sm text-on-surface-variant">
          Selecciona una o más opciones, o déjalo vacío si no se sabe.
        </span>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-labelledby={labelId}
        data-ficha-field={fieldKey('drogas')}
      >
        {OPCIONES_CONSUMO_DROGA.map((droga) => {
          const checked = drogas.includes(droga);
          return (
            <button
              key={droga}
              type="button"
              aria-pressed={checked}
              onClick={() => handleToggle(droga)}
              className="mk-chip mk-chip--filter min-h-10 px-3.5 py-1.5 text-sm transition-transform duration-150 active:scale-95 motion-reduce:transition-none"
            >
              <Icon name={checked ? 'check' : 'add'} className="text-[18px]" />
              <span>{DROGA_LABELS[droga]}</span>
            </button>
          );
        })}
      </div>
      {errores.drogas ? (
        <p role="alert" className="text-sm text-status-danger">
          {errores.drogas}
        </p>
      ) : null}

      {requiereEspecificacionDroga(drogas) ? (
        <div className="grid gap-1">
          <label className="text-sm font-medium text-on-surface-variant">
            Especificación de la sustancia (opcional)
          </label>
          <label className="mk-field">
            <input
              type="text"
              maxLength={ESPECIFICACION_DROGA_MAX}
              data-ficha-field={fieldKey('especificacionDroga')}
              aria-invalid={errores.especificacionDroga ? true : undefined}
              value={especificacionDroga}
              placeholder="Ej. sustancia o frecuencia"
              onChange={(e) => onChange({ especificacionDroga: e.target.value })}
            />
          </label>
          {errores.especificacionDroga ? (
            <p role="alert" className="text-sm text-status-danger">
              {errores.especificacionDroga}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
