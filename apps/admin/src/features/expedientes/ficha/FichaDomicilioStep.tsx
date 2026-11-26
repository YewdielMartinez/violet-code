import { useMemo, useState } from 'react';
import { RadioGroup, Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/radio-group';
import '@yewdiel21/motion-kit/css/components/select';
import type { DomicilioInput, ZonaGeografica } from '@/domain/models/Domicilio';
import { useAsentamientosSepomex } from '../api';

interface Props {
  value: DomicilioInput;
  onChange: (next: DomicilioInput) => void;
  invalidField?: string | null;
}

const ORIGIN_ITEMS = [
  { value: 'ahome', label: 'Ahome (SEPOMEX)' },
  { value: 'foranea', label: 'Foránea (otro municipio/estado)' },
];

const ZONA_ITEMS = [
  { value: 'urbana', label: 'Urbana' },
  { value: 'rural', label: 'Rural' },
];

/**
 * Paso 2 de la Ficha Única: captura estructurada de domicilio (`RN-12.1`).
 * Prioriza flujo CP-first sobre el catálogo SEPOMEX de Ahome (451 asentamientos) y ofrece
 * respaldo de código postal de 5 dígitos para personas foráneas sin mezclar ambos campos.
 */
export function FichaDomicilioStep({ value, onChange, invalidField }: Props) {
  const [cpSearch, setCpSearch] = useState('');
  const [isForanea, setIsForanea] = useState(
    value.asentamientoId === null && value.codigoPostalForaneo.length > 0,
  );

  const cpFilter = /^\d{5}$/.test(cpSearch.trim()) ? cpSearch.trim() : undefined;
  const { data: asentamientos, isLoading } = useAsentamientosSepomex(cpFilter, !isForanea);

  const asentamientoOptions = useMemo(
    () =>
      (asentamientos ?? []).map((a) => ({
        value: String(a.id),
        label: `${a.nombre} (${a.tipoAsentamiento}) · CP ${a.codigoPostal}`,
      })),
    [asentamientos],
  );

  const locationInvalid =
    invalidField === 'asentamientoId' ||
    invalidField === 'codigoPostalForaneo' ||
    invalidField === 'ubicacion';

  function switchOrigin(mode: string) {
    const foranea = mode === 'foranea';
    setIsForanea(foranea);
    if (foranea) {
      onChange({ ...value, asentamientoId: null });
    } else {
      onChange({ ...value, codigoPostalForaneo: '' });
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <RadioGroup
          label="Cobertura geográfica"
          variant="pill"
          items={ORIGIN_ITEMS}
          value={isForanea ? 'foranea' : 'ahome'}
          onChange={(v) => switchOrigin(v ?? 'ahome')}
        />

        <RadioGroup
          label="Zona"
          variant="pill"
          items={ZONA_ITEMS}
          value={value.zona || 'urbana'}
          onChange={(v) => onChange({ ...value, zona: (v ?? 'urbana') as ZonaGeografica })}
        />
      </div>

      {!isForanea ? (
        <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <label className="mk-field">
            <span className="mk-field__label">Filtrar por CP (5 dígitos)</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="Ej. 81200"
              className="font-mono"
              value={cpSearch}
              onChange={(e) => setCpSearch(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
          </label>

          <div className="grid gap-1.5" data-ficha-field="asentamientoId">
            <span
              className={`text-xs font-medium ${
                locationInvalid ? 'text-status-danger' : 'text-on-surface-variant'
              }`}
            >
              Colonia / Ejido / Sindicatura (SEPOMEX Ahome) *
            </span>
            <Select
              label="Colonia / Ejido / Sindicatura (SEPOMEX Ahome) *"
              placeholder={isLoading ? 'Cargando asentamientos…' : 'Selecciona asentamiento…'}
              options={asentamientoOptions}
              value={value.asentamientoId ? String(value.asentamientoId) : ''}
              onChange={(v) =>
                onChange({
                  ...value,
                  asentamientoId: v ? Number(v) : null,
                  codigoPostalForaneo: '',
                })
              }
            />
          </div>
        </div>
      ) : (
        <label className="mk-field max-w-xs">
          <span className="mk-field__label">Código postal foráneo (5 dígitos) *</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="Ej. 80000"
            data-ficha-field="codigoPostalForaneo"
            aria-invalid={locationInvalid || undefined}
            className="font-mono"
            value={value.codigoPostalForaneo}
            onChange={(e) =>
              onChange({
                ...value,
                asentamientoId: null,
                codigoPostalForaneo: e.target.value.replace(/\D/g, '').slice(0, 5),
              })
            }
          />
        </label>
      )}

      <label className="mk-field">
        <span className="mk-field__label">Calle *</span>
        <input
          type="text"
          required
          maxLength={150}
          data-ficha-field="calle"
          aria-invalid={invalidField === 'calle' || undefined}
          value={value.calle}
          onChange={(e) => onChange({ ...value, calle: e.target.value })}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="mk-field">
          <span className="mk-field__label">Número exterior</span>
          <input
            type="text"
            maxLength={30}
            value={value.numeroExterior}
            onChange={(e) => onChange({ ...value, numeroExterior: e.target.value })}
          />
        </label>

        <label className="mk-field">
          <span className="mk-field__label">Número interior</span>
          <input
            type="text"
            maxLength={30}
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
    </div>
  );
}
