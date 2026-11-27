import type { DomicilioInput } from '@/domain/models/Domicilio';
import { DomicilioUbicacionSection } from './DomicilioUbicacionSection';

interface Props {
  value: DomicilioInput;
  onChange: (next: DomicilioInput) => void;
  /** Campo a resaltar tras una validación fallida del asistente (`fichaValidation`). */
  invalidField?: string | null;
}

/**
 * Paso 2 de la Ficha Única: captura estructurada de domicilio (`RN-12.1`).
 * La ubicación geográfica (CP → Estado → Municipio → Ciudad → Colonia) vive en `DomicilioUbicacionSection`,
 * compartida con el domicilio de la persona agresora.
 */
export function FichaDomicilioStep({ value, onChange, invalidField }: Props) {
  const locationInvalid =
    invalidField === 'asentamientoId' ||
    invalidField === 'codigoPostalForaneo' ||
    invalidField === 'ubicacion';

  return (
    <div className="vc-ficha-form grid gap-6">
      <DomicilioUbicacionSection
        value={value}
        onChange={(patch) => onChange({ ...value, ...patch })}
        invalid={locationInvalid}
      />

      <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <h4 className="text-base font-semibold text-on-surface">Dirección y referencias</h4>

        <label className="mk-field">
          <span className="mk-field__label">Calle *</span>
          <input
            type="text"
            required
            maxLength={150}
            placeholder="Nombre de la calle o avenida"
            data-ficha-field="calle"
            aria-invalid={invalidField === 'calle' || undefined}
            value={value.calle}
            onChange={(e) => onChange({ ...value, calle: e.target.value })}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="mk-field">
            <span className="mk-field__label">Número exterior *</span>
            <input
              type="text"
              required
              maxLength={30}
              placeholder="Ej. 120 (o S/N)"
              data-ficha-field="numeroExterior"
              aria-invalid={invalidField === 'numeroExterior' || undefined}
              value={value.numeroExterior}
              onChange={(e) => onChange({ ...value, numeroExterior: e.target.value })}
            />
          </label>

          <label className="mk-field">
            <span className="mk-field__label">Número interior</span>
            <input
              type="text"
              maxLength={30}
              placeholder="Depto., lote o letra"
              value={value.numeroInterior}
              onChange={(e) => onChange({ ...value, numeroInterior: e.target.value })}
            />
          </label>
        </div>

        <label className="mk-field">
          <span className="mk-field__label">Referencias del domicilio</span>
          <input
            type="text"
            maxLength={250}
            placeholder="Entre calles, color de fachada o punto cercano"
            value={value.referencias}
            onChange={(e) => onChange({ ...value, referencias: e.target.value })}
          />
        </label>
      </section>
    </div>
  );
}
