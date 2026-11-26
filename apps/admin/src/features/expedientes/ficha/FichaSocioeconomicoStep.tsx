import { GlassSwitch, MultiSelect, Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/glass-switch';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/multi-select';
import '@yewdiel21/motion-kit/css/components/select';
import {
  BIENES_VIVIENDA,
  EMPTY_APORTANTE,
  MATERIAL_VIVIENDA_LABELS,
  SERVICIOS_VIVIENDA,
  TIPO_VIVIENDA_LABELS,
  type AportanteHogarInput,
  type EstudioSocioeconomicoInput,
  type MaterialVivienda,
  type TipoVivienda,
} from '@/domain/models/EstudioSocioeconomico';
import type { CatalogosFicha } from '@/domain/models/FichaRegistro';
import { FichaAportantesSection } from './FichaAportantesSection';

interface Props {
  value: EstudioSocioeconomicoInput;
  onChange: (next: EstudioSocioeconomicoInput) => void;
  catalogos?: CatalogosFicha;
  invalidField?: string | null;
}

const VIVIENDA_OPTIONS = Object.entries(TIPO_VIVIENDA_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const MATERIAL_OPTIONS = Object.entries(MATERIAL_VIVIENDA_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const SERVICIOS_OPTIONS = [...SERVICIOS_VIVIENDA];
const BIENES_OPTIONS = [...BIENES_VIVIENDA];

/** Paso 3 de la Ficha Única: estudio socioeconómico, vivienda y aportantes del hogar. */
export function FichaSocioeconomicoStep({ value, onChange, catalogos, invalidField }: Props) {
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
            data-ficha-field="ingresoMensualPropio"
            aria-invalid={invalidField === 'ingresoMensualPropio' || undefined}
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
            data-ficha-field="numeroDependientes"
            aria-invalid={invalidField === 'numeroDependientes' || undefined}
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
              data-ficha-field="especificacionApoyo"
              aria-invalid={invalidField === 'especificacionApoyo' || undefined}
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
            data-ficha-field="materialOtro"
            aria-invalid={invalidField === 'materialOtro' || undefined}
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

      <FichaAportantesSection
        aportantes={value.aportantes}
        catalogos={catalogos}
        invalidField={invalidField}
        onAdd={addAportante}
        onRemove={removeAportante}
        onUpdate={updateAportante}
      />
    </div>
  );
}
