import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { inicialNombre, type PersonaSeleccion } from './citaDialogUtils';
import { MIN_TERMINO_BUSQUEDA, terminoBuscable, usePersonaSearch } from './personaSearchApi';

const DEBOUNCE_MS = 300;
const MAX_RESULTADOS = 8;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export interface PersonaSearchFieldProps {
  value: PersonaSeleccion | null;
  onChange: (persona: PersonaSeleccion | null) => void;
  /** `true`: búsqueda por nombre/CURP/folio; `false` (Recepción): solo CURP completa. */
  porNombre: boolean;
  error?: string | null;
  disabled?: boolean;
}

/**
 * Selector de persona existente con búsqueda diferida en el servidor (no se carga el padrón completo).
 * Combobox accesible: flechas, Enter y Escape.
 */
export function PersonaSearchField({ value, onChange, porNombre, error, disabled }: PersonaSearchFieldProps) {
  const ids = { input: useId(), list: useId(), help: useId() };
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const debounced = useDebounced(term, DEBOUNCE_MS);
  const buscable = terminoBuscable(debounced, porNombre);
  const query = usePersonaSearch(debounced, porNombre);
  const resultados = useMemo(() => (buscable ? (query.data ?? []).slice(0, MAX_RESULTADOS) : []), [buscable, query.data]);
  const pendiente = terminoBuscable(term, porNombre) && (term !== debounced || query.isFetching);
  const activeIndex = resultados.length ? Math.min(active, resultados.length - 1) : -1;

  const ayuda = porNombre
    ? `Escribe al menos ${MIN_TERMINO_BUSQUEDA} letras del nombre, la CURP o el folio.`
    : 'Captura la CURP completa (18 caracteres) para localizar a la persona.';

  function seleccionar(index: number) {
    const item = resultados[index];
    if (!item) return;
    onChange({ id: item.id, nombre: item.nombre });
    setTerm('');
    setOpen(false);
    setActive(0);
  }

  function limpiar() {
    onChange(null);
    setTerm('');
    setOpen(true);
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
    } else if (event.key === 'Enter' && open && activeIndex >= 0) {
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
      <div className="vc-cita-persona flex items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="vc-cita-avatar">
            {inicialNombre(value.nombre)}
          </span>
          <span className="truncate text-base font-semibold text-on-surface">{value.nombre}</span>
        </span>
        <button type="button" className="mk-button mk-button--tonal mk-button--sm shrink-0" disabled={disabled} onClick={limpiar}>
          Cambiar
        </button>
      </div>
    );
  }

  const mostrarLista = open && buscable;

  return (
    <div className="grid gap-1.5">
      <label className="mk-field w-full">
        <input
          id={ids.input}
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Persona"
          aria-autocomplete="list"
          aria-expanded={mostrarLista}
          aria-controls={ids.list}
          aria-describedby={ids.help}
          aria-invalid={error ? true : undefined}
          aria-activedescendant={mostrarLista && activeIndex >= 0 ? `${ids.list}-${activeIndex}` : undefined}
          placeholder={porNombre ? 'Buscar por nombre, CURP o folio…' : 'CURP de la persona…'}
          autoComplete="off"
          disabled={disabled}
          value={term}
          onChange={(e) => {
            setTerm(porNombre ? e.target.value : e.target.value.toUpperCase());
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
      </label>

      <p id={ids.help} className={`text-xs ${error ? 'text-status-danger' : 'text-on-surface-variant'}`}>
        {error ?? ayuda}
      </p>

      {mostrarLista ? (
        <div
          id={ids.list}
          role="listbox"
          aria-label="Personas encontradas"
          className="vc-cita-persona-list max-h-56 overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg"
        >
          {pendiente && resultados.length === 0 ? (
            <p role="status" className="px-3 py-3 text-center text-sm text-on-surface-variant">
              Buscando…
            </p>
          ) : null}
          {!pendiente && resultados.length === 0 ? (
            <p role="status" className="px-3 py-3 text-center text-sm text-on-surface-variant">
              {query.isError ? 'No se pudo buscar. Intenta de nuevo.' : 'Sin coincidencias.'}
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
              {item.detalle ? <span className="font-mono text-xs text-on-surface-variant">{item.detalle}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
