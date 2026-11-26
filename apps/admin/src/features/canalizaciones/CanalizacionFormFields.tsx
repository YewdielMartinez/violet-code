import { useId, useMemo, useState } from 'react';
import { Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/select';
import { Icon } from '@/shared/ui/Icon';
import { DESTINO_LABELS, type DestinoDerivacion } from './api';
import type { CanalizacionFormState } from './useCanalizacionForm';

const MOTIVO_MAX_LENGTH = 1000;
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
  const ids = { exp: useId(), motivo: useId(), inst: useId(), destino: useId(), otra: useId() };
  const [query, setQuery] = useState('');

  const expedienteOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalogos.expedientes ?? [])
      .filter(
        (e) =>
          e.id === values.fichaId ||
          !q ||
          e.folio.toLowerCase().includes(q) ||
          e.persona.nombreCompleto.toLowerCase().includes(q),
      )
      .map((e) => ({ value: e.id, label: `${e.folio} · ${e.persona.nombreCompleto}` }));
  }, [catalogos.expedientes, query, values.fichaId]);

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
          <label className="mk-field w-full">
            <input
              id={ids.exp}
              type="search"
              placeholder="Buscar por folio o nombre…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </label>
          <Select
            label="Expediente"
            placeholder="Selecciona expediente…"
            options={expedienteOptions}
            value={values.fichaId}
            onChange={form.setFichaId}
          />
          <FieldError id={`${ids.exp}-err`} message={errors.expediente} />
        </div>
      )}

      <div className="grid gap-1.5">
        <span className="text-sm font-medium text-on-surface">Destino *</span>
        <Select
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
