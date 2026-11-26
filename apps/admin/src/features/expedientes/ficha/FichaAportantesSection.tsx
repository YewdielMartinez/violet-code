import { useMemo } from 'react';
import { Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/select';
import {
  FRECUENCIA_INGRESO_LABELS,
  TIPO_TRABAJO_LABELS,
  type AportanteHogarInput,
  type FrecuenciaIngreso,
  type TipoTrabajo,
} from '@/domain/models/EstudioSocioeconomico';
import type { CatalogosFicha } from '@/domain/models/FichaRegistro';
import { Icon } from '@/shared/ui/Icon';

interface Props {
  aportantes: AportanteHogarInput[];
  catalogos?: CatalogosFicha;
  invalidField?: string | null;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<AportanteHogarInput>) => void;
}

const TRABAJO_OPTIONS = Object.entries(TIPO_TRABAJO_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const FRECUENCIA_OPTIONS = Object.entries(FRECUENCIA_INGRESO_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** Subsección de aportantes del hogar en el Estudio Socioeconómico. */
export function FichaAportantesSection({
  aportantes,
  catalogos,
  invalidField,
  onAdd,
  onRemove,
  onUpdate,
}: Props) {
  const parentescoOptions = useMemo(
    () => (catalogos?.parentescos ?? []).map((p) => ({ value: String(p.id), label: p.nombre })),
    [catalogos?.parentescos],
  );
  const ocupacionOptions = useMemo(
    () => (catalogos?.ocupaciones ?? []).map((o) => ({ value: String(o.id), label: o.nombre })),
    [catalogos?.ocupaciones],
  );

  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-on-surface">Otros aportantes del hogar</h4>
          <p className="text-sm text-on-surface-variant">
            Registra a las personas que contribuyen económicamente en la vivienda.
          </p>
        </div>
        <button type="button" className="mk-button mk-button--tonal" onClick={onAdd}>
          <Icon name="add" />
          <span>Agregar aportante</span>
        </button>
      </div>

      {aportantes.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Sin aportantes adicionales registrados.</p>
      ) : (
        <div className="grid gap-4">
          {aportantes.map((ap, index) => (
            <div key={index} className="grid gap-4 rounded-2xl bg-surface-container-low p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-on-surface-variant">
                  Aportante #{index + 1}
                </span>
                <button
                  type="button"
                  className="mk-button mk-button--text mk-button--sm text-status-danger"
                  onClick={() => onRemove(index)}
                >
                  Quitar
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="mk-field">
                  <span className="mk-field__label">Nombre *</span>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Nombre completo"
                    data-ficha-field={`aportante-${index}-nombre`}
                    aria-invalid={invalidField === `aportante-${index}-nombre` || undefined}
                    value={ap.nombre}
                    onChange={(e) => onUpdate(index, { nombre: e.target.value })}
                  />
                </label>
                <div className="grid gap-2">
                  <span className="vc-ficha-label">Parentesco</span>
                  <Select
                    size="lg"
                    label="Parentesco"
                    placeholder="Selecciona…"
                    options={parentescoOptions}
                    value={ap.parentescoId ? String(ap.parentescoId) : ''}
                    onChange={(v) => onUpdate(index, { parentescoId: v ? Number(v) : null })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <span className="vc-ficha-label">Ocupación</span>
                  <Select
                    size="lg"
                    label="Ocupación"
                    placeholder="Selecciona…"
                    options={ocupacionOptions}
                    value={ap.ocupacionId ? String(ap.ocupacionId) : ''}
                    onChange={(v) => onUpdate(index, { ocupacionId: v ? Number(v) : null })}
                  />
                </div>
                <div className="grid gap-2">
                  <span className="vc-ficha-label">Tipo de trabajo</span>
                  <Select
                    size="lg"
                    label="Tipo de trabajo"
                    placeholder="Selecciona…"
                    options={TRABAJO_OPTIONS}
                    value={ap.tipoTrabajo}
                    onChange={(v) => onUpdate(index, { tipoTrabajo: v as TipoTrabajo })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="mk-field">
                  <span className="mk-field__label">Monto (MXN)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    data-ficha-field={`aportante-${index}-monto`}
                    aria-invalid={invalidField === `aportante-${index}-monto` || undefined}
                    value={ap.monto}
                    onChange={(e) => onUpdate(index, { monto: e.target.value })}
                  />
                </label>
                <div className="grid gap-2">
                  <span className="vc-ficha-label">Frecuencia</span>
                  <Select
                    size="lg"
                    label="Frecuencia"
                    placeholder="Selecciona…"
                    options={FRECUENCIA_OPTIONS}
                    value={ap.frecuencia}
                    onChange={(v) => onUpdate(index, { frecuencia: v as FrecuenciaIngreso })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
