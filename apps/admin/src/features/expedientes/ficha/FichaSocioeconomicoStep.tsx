import { useMemo } from 'react';
import { GlassSwitch, MultiSelect, Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/glass-switch';
import '@yewdiel21/motion-kit/css/components/multi-select';
import '@yewdiel21/motion-kit/css/components/select';
import {
  BIENES_VIVIENDA,
  EMPTY_APORTANTE,
  FRECUENCIA_INGRESO_LABELS,
  MATERIAL_VIVIENDA_LABELS,
  SERVICIOS_VIVIENDA,
  TIPO_TRABAJO_LABELS,
  TIPO_VIVIENDA_LABELS,
  type AportanteHogarInput,
  type EstudioSocioeconomicoInput,
  type FrecuenciaIngreso,
  type MaterialVivienda,
  type TipoTrabajo,
  type TipoVivienda,
} from '@/domain/models/EstudioSocioeconomico';
import type { CatalogosFicha } from '@/domain/models/FichaRegistro';
import { Icon } from '@/shared/ui/Icon';

interface Props {
  value: EstudioSocioeconomicoInput;
  onChange: (next: EstudioSocioeconomicoInput) => void;
  catalogos?: CatalogosFicha;
}

const VIVIENDA_OPTIONS = Object.entries(TIPO_VIVIENDA_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const MATERIAL_OPTIONS = Object.entries(MATERIAL_VIVIENDA_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const TRABAJO_OPTIONS = Object.entries(TIPO_TRABAJO_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const FRECUENCIA_OPTIONS = Object.entries(FRECUENCIA_INGRESO_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const SERVICIOS_OPTIONS = [...SERVICIOS_VIVIENDA];
const BIENES_OPTIONS = [...BIENES_VIVIENDA];

/** Paso 3 de la Ficha Única: estudio socioeconómico, vivienda y aportantes del hogar. */
export function FichaSocioeconomicoStep({ value, onChange, catalogos }: Props) {
  const parentescoOptions = useMemo(
    () => (catalogos?.parentescos ?? []).map((p) => ({ value: String(p.id), label: p.nombre })),
    [catalogos?.parentescos],
  );
  const ocupacionOptions = useMemo(
    () => (catalogos?.ocupaciones ?? []).map((o) => ({ value: String(o.id), label: o.nombre })),
    [catalogos?.ocupaciones],
  );

  function update<K extends keyof EstudioSocioeconomicoInput>(
    key: K,
    fieldVal: EstudioSocioeconomicoInput[K],
  ) {
    onChange({ ...value, [key]: fieldVal });
  }

  function addAportante() {
    update('aportantes', [...value.aportantes, { ...EMPTY_APORTANTE }]);
  }

  function removeAportante(index: number) {
    update(
      'aportantes',
      value.aportantes.filter((_, i) => i !== index),
    );
  }

  function updateAportante(index: number, patch: Partial<AportanteHogarInput>) {
    update(
      'aportantes',
      value.aportantes.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="mk-field">
          <span className="mk-field__label">Ingreso mensual propio (MXN)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={value.ingresoMensualPropio}
            onChange={(e) => update('ingresoMensualPropio', e.target.value)}
          />
        </label>

        <label className="mk-field">
          <span className="mk-field__label">Número de dependientes económicos</span>
          <input
            type="number"
            min={0}
            max={30}
            step={1}
            inputMode="numeric"
            value={value.numeroDependientes}
            onChange={(e) => update('numeroDependientes', e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-3 rounded-2xl bg-surface-container-low p-4">
        <GlassSwitch
          checked={value.tieneApoyo}
          onChange={(checked) => update('tieneApoyo', checked)}
        >
          Recibe apoyo económico o programa social
        </GlassSwitch>

        {value.tieneApoyo ? (
          <label className="mk-field">
            <span className="mk-field__label">Especificación del apoyo *</span>
            <input
              type="text"
              maxLength={250}
              placeholder="Ej. Pensión Bienestar, beca escolar, apoyo familiar"
              value={value.especificacionApoyo}
              onChange={(e) => update('especificacionApoyo', e.target.value)}
            />
          </label>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Tipo de vivienda</span>
          <Select
            label="Tipo de vivienda"
            placeholder="Selecciona…"
            options={VIVIENDA_OPTIONS}
            value={value.tipoVivienda}
            onChange={(v) => update('tipoVivienda', v as TipoVivienda)}
          />
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Material predominante</span>
          <Select
            label="Material predominante"
            placeholder="Selecciona…"
            options={MATERIAL_OPTIONS}
            value={value.material}
            onChange={(v) => update('material', v as MaterialVivienda)}
          />
        </div>
      </div>

      {value.material === 'otro' ? (
        <label className="mk-field">
          <span className="mk-field__label">Especificar material de vivienda *</span>
          <input
            type="text"
            maxLength={100}
            value={value.materialOtro}
            onChange={(e) => update('materialOtro', e.target.value)}
          />
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Servicios con los que cuenta</span>
          <MultiSelect
            label="Servicios con los que cuenta"
            placeholder="Selecciona servicios…"
            options={SERVICIOS_OPTIONS}
            value={value.servicios}
            onChange={(vals) => update('servicios', vals)}
          />
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Bienes en el hogar</span>
          <MultiSelect
            label="Bienes en el hogar"
            placeholder="Selecciona bienes…"
            options={BIENES_OPTIONS}
            value={value.bienes}
            onChange={(vals) => update('bienes', vals)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-outline-variant p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium text-on-surface">Otros aportantes del hogar</h3>
            <p className="text-xs text-on-surface-variant">
              Registra a las personas que contribuyen económicamente en la vivienda.
            </p>
          </div>
          <button type="button" className="mk-button mk-button--tonal mk-button--sm" onClick={addAportante}>
            <Icon name="add" />
            <span className="ml-1">Agregar aportante</span>
          </button>
        </div>

        {value.aportantes.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Sin aportantes adicionales registrados.</p>
        ) : (
          <div className="grid gap-3">
            {value.aportantes.map((ap, index) => (
              <div key={index} className="grid gap-3 rounded-2xl bg-surface-container-low p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-on-surface-variant">
                    Aportante #{index + 1}
                  </span>
                  <button
                    type="button"
                    className="mk-button mk-button--text mk-button--sm text-status-danger"
                    onClick={() => removeAportante(index)}
                  >
                    Quitar
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                  <label className="mk-field">
                    <span className="mk-field__label">Nombre *</span>
                    <input
                      type="text"
                      maxLength={100}
                      value={ap.nombre}
                      onChange={(e) => updateAportante(index, { nombre: e.target.value })}
                    />
                  </label>
                  <div className="grid gap-1.5">
                    <span className="text-xs font-medium text-on-surface-variant">Parentesco</span>
                    <Select
                      label="Parentesco"
                      placeholder="Selecciona…"
                      options={parentescoOptions}
                      value={ap.parentescoId ? String(ap.parentescoId) : ''}
                      onChange={(v) => updateAportante(index, { parentescoId: v ? Number(v) : null })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <span className="text-xs font-medium text-on-surface-variant">Ocupación</span>
                    <Select
                      label="Ocupación"
                      placeholder="Selecciona…"
                      options={ocupacionOptions}
                      value={ap.ocupacionId ? String(ap.ocupacionId) : ''}
                      onChange={(v) => updateAportante(index, { ocupacionId: v ? Number(v) : null })}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                  <div className="grid gap-1.5">
                    <span className="text-xs font-medium text-on-surface-variant">Tipo de trabajo</span>
                    <Select
                      label="Tipo de trabajo"
                      placeholder="Selecciona…"
                      options={TRABAJO_OPTIONS}
                      value={ap.tipoTrabajo}
                      onChange={(v) => updateAportante(index, { tipoTrabajo: v as TipoTrabajo })}
                    />
                  </div>
                  <label className="mk-field">
                    <span className="mk-field__label">Monto (MXN)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={ap.monto}
                      onChange={(e) => updateAportante(index, { monto: e.target.value })}
                    />
                  </label>
                  <div className="grid gap-1.5">
                    <span className="text-xs font-medium text-on-surface-variant">Frecuencia</span>
                    <Select
                      label="Frecuencia"
                      placeholder="Selecciona…"
                      options={FRECUENCIA_OPTIONS}
                      value={ap.frecuencia}
                      onChange={(v) => updateAportante(index, { frecuencia: v as FrecuenciaIngreso })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
