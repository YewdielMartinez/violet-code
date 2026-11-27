import type { AgresorValidationField } from './agresorApi';
import { DomicilioUbicacionSection, type UbicacionValue } from './ficha/DomicilioUbicacionSection';

export interface DomicilioValues {
  asentamientoId: number | null;
  codigoPostal: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  referencias: string;
}

interface Props {
  values: DomicilioValues;
  errores: Partial<Record<AgresorValidationField, string>>;
  onPatch: (patch: Partial<DomicilioValues>) => void;
  surfaceClassName?: string;
  fieldPrefix?: string;
}

/**
 * Domicilio de la persona agresora. Usa la misma captura de ubicación que el domicilio de la usuaria
 * (`DomicilioUbicacionSection`: CP → Estado → Municipio → Ciudad → Colonia) y los mismos campos de dirección.
 * A diferencia de la usuaria, aquí todos los campos son opcionales y no se captura la zona.
 */
export function AgresorDomicilioFields({
  values,
  errores,
  onPatch,
  surfaceClassName = 'bg-surface-container-low',
  fieldPrefix = '',
}: Props) {
  const fieldKey = (name: string) => (fieldPrefix ? `${fieldPrefix}${name}` : name);

  // El modelo del agresor guarda el CP manual en `codigoPostal`; la ubicación compartida lo llama `codigoPostalForaneo`.
  const ubicacion: UbicacionValue = {
    asentamientoId: values.asentamientoId,
    codigoPostalForaneo: values.codigoPostal,
  };

  function handleUbicacionChange(patch: Partial<UbicacionValue>) {
    onPatch({
      ...(patch.asentamientoId !== undefined ? { asentamientoId: patch.asentamientoId } : {}),
      ...(patch.codigoPostalForaneo !== undefined ? { codigoPostal: patch.codigoPostalForaneo } : {}),
    });
  }

  return (
    <fieldset className={`grid gap-4 rounded-2xl border border-outline-variant ${surfaceClassName} p-5 sm:grid-cols-2`}>
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
        Domicilio
      </legend>

      <DomicilioUbicacionSection
        bare
        showZona={false}
        coloniaRequired={false}
        value={ubicacion}
        onChange={handleUbicacionChange}
        invalid={Boolean(errores.codigoPostal)}
        fieldKeys={{
          ubicacion: fieldKey('ubicacion'),
          codigoPostal: fieldKey('codigoPostal'),
          asentamiento: fieldKey('asentamientoId'),
        }}
      />
      {errores.codigoPostal ? (
        <p role="alert" className="text-sm text-status-danger sm:col-span-2">
          {errores.codigoPostal}
        </p>
      ) : null}

      <div className="grid gap-1 sm:col-span-2">
        <label className="mk-field">
          <span className="mk-field__label">Calle</span>
          <input
            type="text"
            maxLength={150}
            placeholder="Nombre de la calle o avenida"
            data-ficha-field={fieldKey('calle')}
            aria-invalid={errores.calle ? true : undefined}
            value={values.calle}
            onChange={(e) => onPatch({ calle: e.target.value })}
          />
        </label>
        {errores.calle ? (
          <p role="alert" className="text-sm text-status-danger">{errores.calle}</p>
        ) : null}
      </div>

      <div className="grid gap-1">
        <label className="mk-field">
          <span className="mk-field__label">Número exterior</span>
          <input
            type="text"
            maxLength={30}
            placeholder="Ej. 120 (o S/N)"
            data-ficha-field={fieldKey('numeroExterior')}
            aria-invalid={errores.numeroExterior ? true : undefined}
            value={values.numeroExterior}
            onChange={(e) => onPatch({ numeroExterior: e.target.value })}
          />
        </label>
        {errores.numeroExterior ? (
          <p role="alert" className="text-sm text-status-danger">{errores.numeroExterior}</p>
        ) : null}
      </div>

      <div className="grid gap-1">
        <label className="mk-field">
          <span className="mk-field__label">Número interior</span>
          <input
            type="text"
            maxLength={30}
            placeholder="Depto., lote o letra"
            data-ficha-field={fieldKey('numeroInterior')}
            aria-invalid={errores.numeroInterior ? true : undefined}
            value={values.numeroInterior}
            onChange={(e) => onPatch({ numeroInterior: e.target.value })}
          />
        </label>
        {errores.numeroInterior ? (
          <p role="alert" className="text-sm text-status-danger">{errores.numeroInterior}</p>
        ) : null}
      </div>

      <div className="grid gap-1 sm:col-span-2">
        <label className="mk-field">
          <span className="mk-field__label">Referencias del domicilio</span>
          <input
            type="text"
            maxLength={250}
            placeholder="Entre calles, color de fachada o punto cercano"
            data-ficha-field={fieldKey('referencias')}
            aria-invalid={errores.referencias ? true : undefined}
            value={values.referencias}
            onChange={(e) => onPatch({ referencias: e.target.value })}
          />
        </label>
        {errores.referencias ? (
          <p role="alert" className="text-sm text-status-danger">{errores.referencias}</p>
        ) : null}
      </div>
    </fieldset>
  );
}
