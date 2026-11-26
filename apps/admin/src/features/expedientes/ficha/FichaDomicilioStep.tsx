import { useEffect, useMemo, useState } from 'react';
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
  /** Campo a resaltar tras una validación fallida del asistente (`fichaValidation`). */
  invalidField?: string | null;
}

const ZONA_ITEMS = [
  { value: 'urbana', label: 'Urbana' },
  { value: 'rural', label: 'Rural' },
];

const NO_LOCALIDAD = 'Sin localidad';

/**
 * Paso 2 de la Ficha Única: captura estructurada de domicilio (`RN-12.1`).
 * Orden operativo: `Código postal → Estado → Municipio → Ciudad/Localidad → Colonia/Asentamiento`
 * con sincronización bidireccional sobre `cat_asentamiento` (SEPOMEX).
 */
export function FichaDomicilioStep({ value, onChange, invalidField }: Props) {
  const { data: allAsentamientos = [], isLoading } = useAsentamientosSepomex(undefined, true);

  const selectedAsentamiento = useMemo(
    () => allAsentamientos.find((a) => a.id === value.asentamientoId) ?? null,
    [allAsentamientos, value.asentamientoId],
  );

  const [cpSearch, setCpSearch] = useState(
    () => value.codigoPostalForaneo || selectedAsentamiento?.codigoPostal || '',
  );
  const [estadoFilter, setEstadoFilter] = useState(() => selectedAsentamiento?.estado ?? '');
  const [municipioFilter, setMunicipioFilter] = useState(
    () => selectedAsentamiento?.municipio ?? '',
  );
  const [ciudadFilter, setCiudadFilter] = useState(
    () => selectedAsentamiento?.localidad ?? '',
  );

  const locationInvalid =
    invalidField === 'asentamientoId' ||
    invalidField === 'codigoPostalForaneo' ||
    invalidField === 'ubicacion';

  const cpTrimmed = cpSearch.trim();
  const hasFullCp = /^\d{5}$/.test(cpTrimmed);

  const cpMatches = useMemo(
    () => (hasFullCp ? allAsentamientos.filter((a) => a.codigoPostal === cpTrimmed) : []),
    [allAsentamientos, hasFullCp, cpTrimmed],
  );

  const fallbackCpMode = hasFullCp && !isLoading && allAsentamientos.length > 0 && cpMatches.length === 0;

  useEffect(() => {
    if (fallbackCpMode && (value.asentamientoId !== null || value.codigoPostalForaneo !== cpTrimmed)) {
      onChange({ ...value, asentamientoId: null, codigoPostalForaneo: cpTrimmed });
    }
  }, [fallbackCpMode, cpTrimmed, value, onChange]);

  const estadoOptions = useMemo(() => {
    const unique = Array.from(new Set(allAsentamientos.map((a) => a.estado))).sort((a, b) =>
      a.localeCompare(b, 'es-MX'),
    );
    return unique.map((estado) => ({ value: estado, label: estado }));
  }, [allAsentamientos]);

  const municipioOptions = useMemo(() => {
    const source = estadoFilter
      ? allAsentamientos.filter((a) => a.estado === estadoFilter)
      : allAsentamientos;
    const unique = Array.from(new Set(source.map((a) => a.municipio))).sort((a, b) =>
      a.localeCompare(b, 'es-MX'),
    );
    return unique.map((mun) => ({ value: mun, label: mun }));
  }, [allAsentamientos, estadoFilter]);

  const ciudadOptions = useMemo(() => {
    const source = allAsentamientos.filter((a) => {
      if (estadoFilter && a.estado !== estadoFilter) return false;
      if (municipioFilter && a.municipio !== municipioFilter) return false;
      return true;
    });
    const unique = Array.from(
      new Set(source.map((a) => a.localidad?.trim() || NO_LOCALIDAD)),
    ).sort((a, b) => a.localeCompare(b, 'es-MX'));
    return unique.map((ciudad) => ({ value: ciudad, label: ciudad }));
  }, [allAsentamientos, estadoFilter, municipioFilter]);

  const filteredAsentamientos = useMemo(() => {
    if (hasFullCp && cpMatches.length > 0) return cpMatches;
    return allAsentamientos.filter((a) => {
      if (estadoFilter && a.estado !== estadoFilter) return false;
      if (municipioFilter && a.municipio !== municipioFilter) return false;
      if (ciudadFilter) {
        const loc = a.localidad?.trim() || NO_LOCALIDAD;
        if (loc !== ciudadFilter) return false;
      }
      return true;
    });
  }, [allAsentamientos, hasFullCp, cpMatches, estadoFilter, municipioFilter, ciudadFilter]);

  const asentamientoOptions = useMemo(
    () =>
      filteredAsentamientos.map((a) => ({
        value: String(a.id),
        label: `${a.nombre} (${a.tipoAsentamiento}) · CP ${a.codigoPostal}`,
      })),
    [filteredAsentamientos],
  );

  function handleCpChange(raw: string) {
    const clean = raw.replace(/\D/g, '').slice(0, 5);
    setCpSearch(clean);
    if (clean.length === 5) {
      const matches = allAsentamientos.filter((a) => a.codigoPostal === clean);
      if (matches.length > 0) {
        setEstadoFilter(matches[0].estado);
        setMunicipioFilter(matches[0].municipio);
        setCiudadFilter(matches[0].localidad?.trim() || NO_LOCALIDAD);
        onChange({
          ...value,
          asentamientoId: matches.length === 1 ? matches[0].id : null,
          codigoPostalForaneo: '',
        });
        return;
      }
    }
    if (value.codigoPostalForaneo || value.asentamientoId !== null) {
      onChange({ ...value, asentamientoId: null, codigoPostalForaneo: '' });
    }
  }

  function handleEstadoChange(nextEstado: string) {
    setEstadoFilter(nextEstado);
    const munList = Array.from(
      new Set(
        allAsentamientos
          .filter((a) => !nextEstado || a.estado === nextEstado)
          .map((a) => a.municipio),
      ),
    );
    const nextMun = munList.length === 1 ? munList[0] : '';
    setMunicipioFilter(nextMun);
    setCiudadFilter('');
    setCpSearch('');
    onChange({ ...value, asentamientoId: null, codigoPostalForaneo: '' });
  }

  function handleMunicipioChange(nextMunicipio: string) {
    setMunicipioFilter(nextMunicipio);
    if (nextMunicipio && !estadoFilter) {
      const match = allAsentamientos.find((a) => a.municipio === nextMunicipio);
      if (match) setEstadoFilter(match.estado);
    }
    setCiudadFilter('');
    setCpSearch('');
    onChange({ ...value, asentamientoId: null, codigoPostalForaneo: '' });
  }

  function handleCiudadChange(nextCiudad: string) {
    setCiudadFilter(nextCiudad);
    setCpSearch('');
    onChange({ ...value, asentamientoId: null, codigoPostalForaneo: '' });
  }

  function handleAsentamientoChange(rawId: string) {
    const id = rawId ? Number(rawId) : null;
    const match = id ? allAsentamientos.find((a) => a.id === id) : null;
    if (match) {
      setEstadoFilter(match.estado);
      setMunicipioFilter(match.municipio);
      setCiudadFilter(match.localidad?.trim() || NO_LOCALIDAD);
      setCpSearch(match.codigoPostal);
    }
    onChange({
      ...value,
      asentamientoId: id,
      codigoPostalForaneo: '',
    });
  }

  const resolvedEstado = estadoFilter || selectedAsentamiento?.estado || '';
  const resolvedMunicipio = municipioFilter || selectedAsentamiento?.municipio || '';
  const resolvedCiudad =
    ciudadFilter || (selectedAsentamiento ? selectedAsentamiento.localidad?.trim() || NO_LOCALIDAD : '');

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end" data-ficha-field="ubicacion">
        <label className="mk-field">
          <span className="mk-field__label">Código postal (5 dígitos)</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="Ej. 81200"
            data-ficha-field="codigoPostalForaneo"
            aria-invalid={locationInvalid || undefined}
            className="font-mono"
            value={cpSearch}
            onChange={(e) => handleCpChange(e.target.value)}
          />
        </label>

        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Estado</span>
          <Select
            label="Estado"
            placeholder={isLoading ? 'Cargando…' : 'Selecciona estado…'}
            options={estadoOptions}
            value={resolvedEstado}
            onChange={handleEstadoChange}
          />
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Municipio</span>
          <Select
            label="Municipio"
            placeholder={isLoading ? 'Cargando…' : 'Selecciona municipio…'}
            options={municipioOptions}
            value={resolvedMunicipio}
            onChange={handleMunicipioChange}
          />
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Ciudad / Localidad</span>
          <Select
            label="Ciudad / Localidad"
            placeholder={isLoading ? 'Cargando…' : 'Selecciona ciudad…'}
            options={ciudadOptions}
            value={resolvedCiudad}
            onChange={handleCiudadChange}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        {fallbackCpMode ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            CP <span className="font-mono font-medium text-on-surface">{cpTrimmed}</span> sin
            asentamientos en catálogo local; se registrará con el código postal.
          </div>
        ) : (
          <div className="grid gap-1.5" data-ficha-field="asentamientoId">
            <span
              className={`text-xs font-medium ${
                locationInvalid ? 'text-status-danger' : 'text-on-surface-variant'
              }`}
            >
              Colonia / Asentamiento (SEPOMEX) *
            </span>
            <Select
              label="Colonia / Asentamiento (SEPOMEX) *"
              placeholder={
                isLoading
                  ? 'Cargando asentamientos…'
                  : 'Selecciona colonia o localidad…'
              }
              options={asentamientoOptions}
              value={value.asentamientoId ? String(value.asentamientoId) : ''}
              onChange={handleAsentamientoChange}
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
