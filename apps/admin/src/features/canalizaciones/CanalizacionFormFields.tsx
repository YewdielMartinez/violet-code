import { useId, useMemo, useRef, useState } from 'react';
import { Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/select';
import { Icon } from '@/shared/ui/Icon';
import { DESTINO_LABELS, type DestinoDerivacion } from './api';
import type { CanalizacionFormState } from './useCanalizacionForm';

const MOTIVO_MAX_LENGTH = 1000;
const MAX_RESULTS = 25;
const INTERNAS = 'Áreas internas';
const EXTERNAS = 'Instituciones externas';

const DESTINO_OPTIONS: Array<{ value: DestinoDerivacion; label: string; group: string }> = [
  { value: 'trabajo_social', label: 'Trabajo Social', group: INTERNAS },
  { value: 'psicologia', label: 'Psicología (+18 años)', group: INTERNAS },
  { value: 'juridico', label: 'Jurídico (+18 años)', group: INTERNAS },
  { value: 'fiscalia', label: DESTINO_LABELS.fiscalia, group: EXTERNAS },
  { value: 'refugio', label: DESTINO_LABELS.refugio, group: EXTERNAS },
  { value: 'capacitacion', label: DESTINO_LABELS.capacitacion, group: EXTERNAS },
  { value: 'otra_institucion', label: DESTINO_LABELS.otra_institucion, group: EXTERNAS },
];

function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1 text-xs font-medium text-status-danger">
      <Icon name="error" className="text-[14px]" />
      {message}
    </p>
  );
}

interface Props {
  form: CanalizacionFormState;
  fixedFolio?: string;
}

/** Campos del formulario de nueva canalización: una sola pantalla, sin pasos. */
export function CanalizacionFormFields({ form, fixedFolio }: Props) {
  const { catalogos, values, errors, internal } = form;
  const ids = { exp: useId(), expList: useId(), motivo: useId(), inst: useId(), destino: useId(), otra: useId() };
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedExpediente = useMemo(
    () => (catalogos.expedientes ?? []).find((e) => e.id === values.fichaId) ?? null,
    [catalogos.expedientes, values.fichaId],
  );

  const matches = useMemo(() => {
    const list = catalogos.expedientes ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.folio.toLowerCase().includes(q) ||
        e.persona.nombreCompleto.toLowerCase().includes(q) ||
        (e.persona.curp ?? '').toLowerCase().includes(q),
    );
  }, [catalogos.expedientes, query]);

  const visibleExpedientes = useMemo(() => matches.slice(0, MAX_RESULTS), [matches]);
  const clampedActiveIndex = visibleExpedientes.length > 0 ? Math.min(activeIndex, visibleExpedientes.length - 1) : -1;

  function selectExpediente(id: string) {
    form.setFichaId(id);
    setQuery('');
    setListOpen(false);
    setActiveIndex(0);
  }

  function handleClearExpediente() {
    form.setFichaId('');
    setQuery('');
    setActiveIndex(0);
    setListOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function handleExpedienteKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!listOpen) {
        setListOpen(true);
        setActiveIndex(0);
        return;
      }
      if (visibleExpedientes.length > 0) {
        setActiveIndex((prev) => (prev + 1) % visibleExpedientes.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!listOpen) {
        setListOpen(true);
        setActiveIndex(Math.max(0, visibleExpedientes.length - 1));
        return;
      }
      if (visibleExpedientes.length > 0) {
        setActiveIndex((prev) => (prev - 1 + visibleExpedientes.length) % visibleExpedientes.length);
      }
    } else if (e.key === 'Enter') {
      if (listOpen && clampedActiveIndex >= 0 && visibleExpedientes[clampedActiveIndex]) {
        e.preventDefault();
        selectExpediente(visibleExpedientes[clampedActiveIndex].id);
      }
    } else if (e.key === 'Escape') {
      if (listOpen) {
        e.preventDefault();
        e.stopPropagation();
        setListOpen(false);
      }
    }
  }

  const institucionOptions = useMemo(
    () => [
      { value: '', label: 'Otra institución (capturar nombre)' },
      ...(catalogos.instituciones ?? []).map((i) => ({ value: String(i.id), label: i.nombre })),
    ],
    [catalogos.instituciones],
  );

  const destinoError = errors.destino ?? form.reglaError;

  return (
    <div className="vc-canalizacion-form grid gap-5">
      {fixedFolio ? (
        <p className="flex items-center gap-2 rounded-2xl bg-surface-container px-4 py-3 text-sm text-on-surface">
          <Icon name="folder_open" className="text-[18px] text-on-surface-variant" />
          Expediente <strong className="font-mono">{fixedFolio}</strong>
        </p>
      ) : (
        <div className="grid gap-1.5">
          <label htmlFor={ids.exp} className="text-sm font-medium text-on-surface">
            Expediente *
          </label>
          {selectedExpediente ? (
            <div className="rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold text-on-surface">{selectedExpediente.folio}</p>
                <p className="truncate text-base font-semibold text-on-surface">
                  {selectedExpediente.persona.nombreCompleto}
                </p>
                <p className="font-mono text-xs text-on-surface-variant">{selectedExpediente.persona.curp}</p>
              </div>
              <button
                type="button"
                className="mk-button mk-button--tonal mk-button--sm shrink-0"
                onClick={handleClearExpediente}
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <label className="mk-field w-full">
                <input
                  id={ids.exp}
                  ref={searchInputRef}
                  type="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-label="Expediente"
                  aria-expanded={listOpen}
                  aria-controls={ids.expList}
                  aria-activedescendant={
                    listOpen && clampedActiveIndex >= 0 && visibleExpedientes[clampedActiveIndex]
                      ? `${ids.expList}-opt-${visibleExpedientes[clampedActiveIndex].id}`
                      : undefined
                  }
                  aria-invalid={errors.expediente ? true : undefined}
                  aria-describedby={errors.expediente ? `${ids.exp}-err` : undefined}
                  placeholder="Buscar por folio, nombre o CURP…"
                  value={query}
                  onFocus={() => setListOpen(true)}
                  onBlur={() => setListOpen(false)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setListOpen(true);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleExpedienteKeyDown}
                  autoComplete="off"
                />
              </label>
              {listOpen ? (
                <div
                  id={ids.expList}
                  role="listbox"
                  aria-label="Expedientes"
                  className="max-h-64 overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg"
                >
                  {visibleExpedientes.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-on-surface-variant">
                      Sin expedientes que coincidan
                    </p>
                  ) : (
                    <>
                      {visibleExpedientes.map((e, idx) => {
                        const isActive = idx === clampedActiveIndex;
                        return (
                          <button
                            key={e.id}
                            id={`${ids.expList}-opt-${e.id}`}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onMouseDown={(ev) => ev.preventDefault()}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => selectExpediente(e.id)}
                            className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                              isActive ? 'bg-surface-container-high text-on-surface' : 'hover:bg-surface-container'
                            }`}
                          >
                            <span className="font-mono text-sm font-semibold text-on-surface">{e.folio}</span>
                            <span className="text-base font-medium text-on-surface">{e.persona.nombreCompleto}</span>
                            <span className="font-mono text-xs text-on-surface-variant">{e.persona.curp}</span>
                          </button>
                        );
                      })}
                      {matches.length > MAX_RESULTS ? (
                        <p className="border-t border-outline-variant px-3 py-2 text-xs text-on-surface-variant">
                          Mostrando {MAX_RESULTS} de {matches.length} expedientes — escribe más para afinar
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </>
          )}
          <FieldError id={`${ids.exp}-err`} message={errors.expediente} />
        </div>
      )}

      <div className="grid gap-1.5">
        <span className="text-sm font-medium text-on-surface">Destino *</span>
        <Select
          size="lg"
          label="Destino"
          options={DESTINO_OPTIONS}
          value={values.destino}
          onChange={(v) => form.changeDestino(v as DestinoDerivacion)}
        />
        <FieldError id={`${ids.destino}-err`} message={destinoError} />
      </div>

      {!internal ? (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-on-surface">Institución</span>
          <Select
            size="lg"
            label="Institución del directorio"
            options={institucionOptions}
            value={values.institucionId ? String(values.institucionId) : ''}
            onChange={(v) => form.setInstitucionId(v ? Number(v) : null)}
          />
          {values.institucionId === null ? (
            <label className="mk-field w-full">
              <input
                type="text"
                aria-label="Nombre de la institución externa"
                maxLength={200}
                aria-invalid={errors.institucion ? true : undefined}
                aria-describedby={errors.institucion ? `${ids.inst}-err` : undefined}
                placeholder={
                  values.destino === 'refugio'
                    ? 'Solo nombre del refugio (nunca capturar dirección)'
                    : 'Nombre de la dependencia o institución'
                }
                value={values.institucionOtra}
                onChange={(e) => form.setInstitucionOtra(e.target.value)}
              />
            </label>
          ) : null}
          <FieldError id={`${ids.inst}-err`} message={errors.institucion} />
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={ids.motivo} className="text-sm font-medium text-on-surface">
            Motivo y observaciones *
          </label>
          <span className="font-mono text-[11px] text-on-surface-variant">
            {values.motivo.length}/{MOTIVO_MAX_LENGTH}
          </span>
        </div>
        <label className="mk-field w-full">
          <textarea
            id={ids.motivo}
            rows={4}
            maxLength={MOTIVO_MAX_LENGTH}
            placeholder="Describe por qué se canaliza a la usuaria y qué seguimiento requiere…"
            value={values.motivo}
            onChange={(e) => form.setMotivo(e.target.value)}
            aria-required="true"
            aria-invalid={errors.motivo ? true : undefined}
            aria-describedby={errors.motivo ? `${ids.motivo}-err` : undefined}
            className="w-full resize-y"
          />
        </label>
        <FieldError id={`${ids.motivo}-err`} message={errors.motivo} />
      </div>

      <FieldError id={`${ids.otra}-err`} message={errors.general} />
    </div>
  );
}
