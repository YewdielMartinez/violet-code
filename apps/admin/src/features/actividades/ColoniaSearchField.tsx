import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { AsentamientoSepomex } from '@/domain/models/Domicilio';

const MAX_RESULTADOS = 8;

function normalizar(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export interface ColoniaSearchFieldProps {
  value: AsentamientoSepomex | null;
  onChange: (asentamiento: AsentamientoSepomex | null) => void;
  /** Catálogo SEPOMEX de Ahome (451 colonias): se filtra aquí, sin montar un `Select` con todas las opciones. */
  asentamientos: readonly AsentamientoSepomex[];
  loading?: boolean;
  disabled?: boolean;
}

/** Selector de colonia con búsqueda local por nombre o código postal (combobox accesible: flechas, Enter, Escape). */
export function ColoniaSearchField({ value, onChange, asentamientos, loading, disabled }: ColoniaSearchFieldProps) {
  const ids = { list: useId(), help: useId() };
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const termino = normalizar(term);
  const resultados = useMemo(() => {
    if (termino.length < 2) return [];
    const found: AsentamientoSepomex[] = [];
    for (const item of asentamientos) {
      if (normalizar(item.nombre).includes(termino) || item.codigoPostal.startsWith(termino)) {
        found.push(item);
        if (found.length === MAX_RESULTADOS) break;
      }
    }
    return found;
  }, [asentamientos, termino]);
  const activeIndex = resultados.length ? Math.min(active, resultados.length - 1) : -1;
  const mostrarLista = open && termino.length >= 2;

  function seleccionar(index: number) {
    const item = resultados[index];
    if (!item) return;
    onChange(item);
    setTerm('');
    setOpen(false);
    setActive(0);
  }

  function limpiar() {
    onChange(null);
    setTerm('');
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && resultados.length) {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % resultados.length);
    } else if (event.key === 'ArrowUp' && resultados.length) {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i - 1 + resultados.length) % resultados.length);
    } else if (event.key === 'Enter' && mostrarLista && activeIndex >= 0) {
      event.preventDefault();
      seleccionar(activeIndex);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-2.5">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-on-surface">{value.nombre}</span>
          <span className="block truncate text-xs text-on-surface-variant">
            {[value.tipoAsentamiento, value.codigoPostal ? `CP ${value.codigoPostal}` : '', value.municipio].filter(Boolean).join(' · ')}
          </span>
        </span>
        <button type="button" className="mk-button mk-button--tonal mk-button--sm act-btn shrink-0" disabled={disabled} onClick={limpiar}>
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      <label className="mk-field w-full">
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Colonia"
          aria-autocomplete="list"
          aria-expanded={mostrarLista}
          aria-controls={ids.list}
          aria-describedby={ids.help}
          aria-activedescendant={mostrarLista && activeIndex >= 0 ? `${ids.list}-${activeIndex}` : undefined}
          placeholder={loading ? 'Cargando colonias…' : 'Buscar colonia por nombre o código postal…'}
          autoComplete="off"
          disabled={disabled}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
      </label>
      <p id={ids.help} className="text-xs text-on-surface-variant">
        Opcional. Escribe al menos 2 letras o el código postal.
      </p>

      {mostrarLista ? (
        <div
          id={ids.list}
          role="listbox"
          aria-label="Colonias encontradas"
          className="act-pop max-h-56 overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg"
        >
          {resultados.length === 0 ? (
            <p role="status" className="px-3 py-3 text-center text-sm text-on-surface-variant">
              {loading ? 'Cargando colonias…' : 'Sin coincidencias.'}
            </p>
          ) : null}
          {resultados.map((item, index) => (
            <button
              key={item.id}
              id={`${ids.list}-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => seleccionar(index)}
              className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors ${
                index === activeIndex ? 'bg-surface-container-high' : 'hover:bg-surface-container'
              }`}
            >
              <span className="text-sm font-semibold text-on-surface">{item.nombre}</span>
              <span className="text-xs text-on-surface-variant">
                {item.tipoAsentamiento} · CP {item.codigoPostal}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
