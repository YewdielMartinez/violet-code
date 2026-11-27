import { useEffect, useMemo, useState } from 'react';
import { RadioGroup, Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/radio-group';
import '@yewdiel21/motion-kit/css/components/select';
import type { ZonaGeografica } from '@/domain/models/Domicilio';
import { useAsentamientosSepomex } from '../api';

export interface UbicacionValue {
  asentamientoId: number | null;
  /** CP de respaldo (5 dígitos) cuando el CP no existe en el catálogo (`asentamientoId === null`). */
  codigoPostalForaneo: string;
  zona?: ZonaGeografica | '';
}

export interface UbicacionFieldKeys {
  ubicacion: string;
  codigoPostal: string;
  asentamiento: string;
}

const DEFAULT_KEYS: UbicacionFieldKeys = {
  ubicacion: 'ubicacion',
  codigoPostal: 'codigoPostalForaneo',
  asentamiento: 'asentamientoId',
};

interface Props {
  value: UbicacionValue;
  /** Recibe solo los campos que cambian; quien consume los fusiona con su estado. */
  onChange: (patch: Partial<UbicacionValue>) => void;
  /** Resalta la ubicación tras una validación fallida. */
  invalid?: boolean;
  /** Sin tarjeta ni encabezado propios: para incrustarla dentro de otro `fieldset`. */
  bare?: boolean;
  showZona?: boolean;
  /** Añade `*` a «Colonia / Asentamiento». */
  coloniaRequired?: boolean;
  /** Claves `data-ficha-field` (para enfocar el campo inválido). */
  fieldKeys?: Partial<UbicacionFieldKeys>;
}

const ZONA_ITEMS = [
  { value: 'urbana', label: 'Urbana' },
  { value: 'rural', label: 'Rural' },
];

const NO_LOCALIDAD = 'Sin localidad';

/**
 * Captura estructurada de ubicación (`RN-12.1`), compartida por el domicilio de la usuaria y el de la
 * persona agresora. Orden operativo: `Código postal → Estado → Municipio → Ciudad/Localidad → Colonia/Asentamiento`
 * con sincronización bidireccional sobre `cat_asentamiento` (SEPOMEX).
 */
export function DomicilioUbicacionSection({
  value,
  onChange,
  invalid = false,
  bare = false,
  showZona = true,
  coloniaRequired = true,
  fieldKeys,
}: Props) {
  const keys = { ...DEFAULT_KEYS, ...fieldKeys };
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

  const cpTrimmed = cpSearch.trim();
  const hasFullCp = /^\d{5}$/.test(cpTrimmed);

  const cpMatches = useMemo(
    () => (hasFullCp ? allAsentamientos.filter((a) => a.codigoPostal === cpTrimmed) : []),
    [allAsentamientos, hasFullCp, cpTrimmed],
  );

  const fallbackCpMode = hasFullCp && !isLoading && allAsentamientos.length > 0 && cpMatches.length === 0;

  useEffect(() => {
    if (fallbackCpMode && (value.asentamientoId !== null || value.codigoPostalForaneo !== cpTrimmed)) {
      onChange({ asentamientoId: null, codigoPostalForaneo: cpTrimmed });
    }
  }, [fallbackCpMode, cpTrimmed, value.asentamientoId, value.codigoPostalForaneo, onChange]);

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
          asentamientoId: matches.length === 1 ? matches[0].id : null,
          codigoPostalForaneo: '',
        });
        return;
      }
      if (!isLoading && allAsentamientos.length > 0) {
        if (value.asentamientoId !== null || value.codigoPostalForaneo !== clean) {
          onChange({ asentamientoId: null, codigoPostalForaneo: clean });
        }
        return;
      }
    }
    if (value.codigoPostalForaneo || value.asentamientoId !== null) {
      onChange({ asentamientoId: null, codigoPostalForaneo: '' });
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
    onChange({ asentamientoId: null, codigoPostalForaneo: '' });
  }

  function handleMunicipioChange(nextMunicipio: string) {
    setMunicipioFilter(nextMunicipio);
    if (nextMunicipio && !estadoFilter) {
      const match = allAsentamientos.find((a) => a.municipio === nextMunicipio);
      if (match) setEstadoFilter(match.estado);
    }
    setCiudadFilter('');
    setCpSearch('');
    onChange({ asentamientoId: null, codigoPostalForaneo: '' });
  }

  function handleCiudadChange(nextCiudad: string) {
    setCiudadFilter(nextCiudad);
    setCpSearch('');
    onChange({ asentamientoId: null, codigoPostalForaneo: '' });
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
    onChange({ asentamientoId: id, codigoPostalForaneo: '' });
  }

  const resolvedEstado = estadoFilter || selectedAsentamiento?.estado || '';
  const resolvedMunicipio = municipioFilter || selectedAsentamiento?.municipio || '';
  const resolvedCiudad =
    ciudadFilter || (selectedAsentamiento ? selectedAsentamiento.localidad?.trim() || NO_LOCALIDAD : '');

  const body = (
    <>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-end" data-ficha-field={keys.ubicacion}>
        <label className="mk-field">
          <span className="mk-field__label">Código postal (5 dígitos)</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="Ej. 81200"
            data-ficha-field={keys.codigoPostal}
            aria-invalid={invalid || undefined}
            className="font-mono"
            value={cpSearch}
            onChange={(e) => handleCpChange(e.target.value)}
          />
        </label>

        <div className="grid gap-2">
          <span className="vc-ficha-label">Estado</span>
          <Select
            size="lg"
            label="Estado"
            placeholder={isLoading ? 'Cargando…' : 'Selecciona estado…'}
            options={estadoOptions}
            value={resolvedEstado}
            onChange={handleEstadoChange}
          />
        </div>

        <div className="grid gap-2">
          <span className="vc-ficha-label">Municipio</span>
          <Select
            size="lg"
            label="Municipio"
            placeholder={isLoading ? 'Cargando…' : 'Selecciona municipio…'}
            options={municipioOptions}
            value={resolvedMunicipio}
            onChange={handleMunicipioChange}
          />
        </div>

        <div className="grid gap-2">
          <span className="vc-ficha-label">Ciudad / Localidad</span>
          <Select
            size="lg"
            label="Ciudad / Localidad"
            placeholder={isLoading ? 'Cargando…' : 'Selecciona ciudad…'}
            options={ciudadOptions}
            value={resolvedCiudad}
            onChange={handleCiudadChange}
          />
        </div>
      </div>

      <div
        className={`grid gap-4 sm:items-end ${showZona ? 'sm:grid-cols-[minmax(0,1fr)_auto]' : ''}`}
      >
        {fallbackCpMode ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            CP <span className="font-mono font-medium text-on-surface">{cpTrimmed}</span> sin
            asentamientos en catálogo local; se registrará con el código postal.
          </div>
        ) : (
          <div
            className="grid gap-2"
            data-ficha-field={keys.asentamiento}
            data-ficha-invalid={invalid || undefined}
          >
            <span className={`vc-ficha-label ${invalid ? 'text-status-danger' : ''}`}>
              Colonia / Asentamiento{coloniaRequired ? ' *' : ''}
            </span>
            <Select
              size="lg"
              label={coloniaRequired ? 'Colonia / Asentamiento *' : 'Colonia / Asentamiento'}
              placeholder={
                isLoading ? 'Cargando asentamientos…' : 'Selecciona colonia o localidad…'
              }
              options={asentamientoOptions}
              value={value.asentamientoId ? String(value.asentamientoId) : ''}
              onChange={handleAsentamientoChange}
            />
          </div>
        )}

        {showZona ? (
          <div className="grid gap-2">
            <span className="vc-ficha-label">Zona</span>
            <RadioGroup
              label="Zona"
              variant="pill"
              items={ZONA_ITEMS}
              value={value.zona || 'urbana'}
              onChange={(v) => onChange({ zona: (v ?? 'urbana') as ZonaGeografica })}
            />
          </div>
        ) : null}
      </div>
    </>
  );

  if (bare) return <div className="grid gap-4 sm:col-span-2">{body}</div>;

  return (
    <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
      <header>
        <h4 className="text-base font-semibold text-on-surface">Ubicación geográfica</h4>
        <p className="text-sm text-on-surface-variant">
          Captura el código postal o selecciona estado, municipio y colonia del catálogo.
        </p>
      </header>
      {body}
    </section>
  );
}
