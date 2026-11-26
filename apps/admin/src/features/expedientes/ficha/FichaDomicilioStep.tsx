import { useEffect, useMemo, useState } from 'react';
import { RadioGroup, Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/radio-group';
import '@yewdiel21/motion-kit/css/components/select';
import type { DomicilioInput, ZonaGeografica } from '@/domain/models/Domicilio';
import { useAsentamientosSepomex } from '../api';

interface Props {
  value: DomicilioInput;
  onChange: (next: DomicilioInput) => void;
}

const ZONA_ITEMS = [
  { value: 'urbana', label: 'Urbana' },
  { value: 'rural', label: 'Rural' },
];

/**
 * Paso 2 de la Ficha Única: captura estructurada de domicilio (`RN-12.1`).
 * Flujo CP-first automático: al capturar 5 dígitos consulta `cat_asentamiento` (SEPOMEX);
 * si existen colonias para ese CP las muestra en el selector, y si el CP aún no está en
 * el catálogo local conserva el código postal directamente sin toggles manuales.
 */
export function FichaDomicilioStep({ value, onChange }: Props) {
  const [cpSearch, setCpSearch] = useState(value.codigoPostalForaneo);
  const cpTrimmed = cpSearch.trim();
  const hasFullCp = /^\d{5}$/.test(cpTrimmed);

  const { data: asentamientos, isLoading } = useAsentamientosSepomex(
    hasFullCp ? cpTrimmed : undefined,
    true,
  );

  const hasCatalogMatch = !isLoading && (asentamientos?.length ?? 0) > 0;
  const fallbackCpMode = hasFullCp && !isLoading && (asentamientos?.length ?? 0) === 0;

  const asentamientoOptions = useMemo(
    () =>
      (asentamientos ?? []).map((a) => ({
        value: String(a.id),
        label: `${a.nombre} (${a.tipoAsentamiento}) · CP ${a.codigoPostal}`,
      })),
    [asentamientos],
  );

  useEffect(() => {
    if (fallbackCpMode && (value.asentamientoId !== null || value.codigoPostalForaneo !== cpTrimmed)) {
      onChange({ ...value, asentamientoId: null, codigoPostalForaneo: cpTrimmed });
    }
  }, [fallbackCpMode, cpTrimmed, value, onChange]);

  function handleCpChange(raw: string) {
    const clean = raw.replace(/\D/g, '').slice(0, 5);
    setCpSearch(clean);
    if (value.codigoPostalForaneo) {
      onChange({ ...value, codigoPostalForaneo: '' });
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
        <label className="mk-field">
          <span className="mk-field__label">Código postal (5 dígitos)</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="Ej. 81200"
            className="font-mono"
            value={cpSearch}
            onChange={(e) => handleCpChange(e.target.value)}
          />
        </label>

        {fallbackCpMode ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            CP <span className="font-mono font-medium text-on-surface">{cpTrimmed}</span> sin
            asentamientos en catálogo local; se registrará con el código postal.
          </div>
        ) : (
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-on-surface-variant">
              Colonia / Asentamiento (SEPOMEX) *
            </span>
            <Select
              label="Colonia / Asentamiento (SEPOMEX) *"
              placeholder={
                isLoading
                  ? 'Buscando asentamientos…'
                  : hasCatalogMatch
                    ? 'Selecciona asentamiento…'
                    : 'Escribe un CP o elige del catálogo…'
              }
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
        )}

        <RadioGroup
          label="Zona"
          variant="pill"
          items={ZONA_ITEMS}
          value={value.zona || 'urbana'}
          onChange={(v) => onChange({ ...value, zona: (v ?? 'urbana') as ZonaGeografica })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="mk-field sm:col-span-1">
          <span className="mk-field__label">Calle *</span>
          <input
            type="text"
            required
            maxLength={150}
            value={value.calle}
            onChange={(e) => onChange({ ...value, calle: e.target.value })}
          />
        </label>

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
