import { useMemo } from 'react';
import { GlassSwitch, MultiSelect, Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/glass-switch';
import '@yewdiel21/motion-kit/css/components/multi-select';
import '@yewdiel21/motion-kit/css/components/select';
import {
  ESCOLARIDAD_LABELS,
  ESTADO_CIVIL_LABELS,
  SERVICIO_MEDICO_LABELS,
  type CatalogosFicha,
  type EscolaridadNivel,
  type EstadoCivil,
  type FichaIdentidadInput,
  type ServicioMedico,
} from '@/domain/models/FichaRegistro';
import { normalizeCurp } from '@/domain/models/Persona';

interface Props {
  value: FichaIdentidadInput;
  onChange: (next: FichaIdentidadInput) => void;
  catalogos?: CatalogosFicha;
}

const ESTADO_CIVIL_OPTIONS = Object.entries(ESTADO_CIVIL_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const ESCOLARIDAD_OPTIONS = Object.entries(ESCOLARIDAD_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const SERVICIO_MEDICO_OPTIONS = Object.entries(SERVICIO_MEDICO_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** Paso 1 de la Ficha Única: datos generales, servicios solicitados y Aviso de Privacidad (`RNF-04`). */
export function FichaIdentidadStep({ value, onChange, catalogos }: Props) {
  const areaOptions = useMemo(
    () => (catalogos?.areas ?? []).map((a) => ({ value: String(a.id), label: a.nombre })),
    [catalogos?.areas],
  );
  const ocupacionOptions = useMemo(
    () => (catalogos?.ocupaciones ?? []).map((o) => ({ value: String(o.id), label: o.nombre })),
    [catalogos?.ocupaciones],
  );

  function update<K extends keyof FichaIdentidadInput>(key: K, fieldVal: FichaIdentidadInput[K]) {
    onChange({ ...value, [key]: fieldVal });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="mk-field">
          <span className="mk-field__label">CURP *</span>
          <input
            type="text"
            maxLength={18}
            required
            className="font-mono uppercase"
            value={value.curp}
            onChange={(e) => update('curp', normalizeCurp(e.target.value))}
          />
        </label>

        <label className="mk-field">
          <span className="mk-field__label">Teléfono celular (10 dígitos)</span>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="6680000000"
            value={value.celular}
            onChange={(e) => update('celular', e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="mk-field">
          <span className="mk-field__label">Nombre(s) *</span>
          <input
            type="text"
            required
            maxLength={100}
            value={value.nombres}
            onChange={(e) => update('nombres', e.target.value)}
          />
        </label>

        <label className="mk-field">
          <span className="mk-field__label">Apellido paterno *</span>
          <input
            type="text"
            required
            maxLength={100}
            value={value.apellidoPaterno}
            onChange={(e) => update('apellidoPaterno', e.target.value)}
          />
        </label>

        <label className="mk-field">
          <span className="mk-field__label">Apellido materno</span>
          <input
            type="text"
            maxLength={100}
            value={value.apellidoMaterno}
            onChange={(e) => update('apellidoMaterno', e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Estado civil</span>
          <Select
            label="Estado civil"
            placeholder="Selecciona…"
            options={ESTADO_CIVIL_OPTIONS}
            value={value.estadoCivil}
            onChange={(v) => update('estadoCivil', v as EstadoCivil)}
          />
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Escolaridad</span>
          <Select
            label="Escolaridad"
            placeholder="Selecciona…"
            options={ESCOLARIDAD_OPTIONS}
            value={value.escolaridad}
            onChange={(v) => update('escolaridad', v as EscolaridadNivel)}
          />
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Ocupación</span>
          <Select
            label="Ocupación"
            placeholder="Selecciona…"
            options={ocupacionOptions}
            value={value.ocupacionId ? String(value.ocupacionId) : ''}
            onChange={(v) => update('ocupacionId', v ? Number(v) : null)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Servicio médico</span>
          <Select
            label="Servicio médico"
            options={SERVICIO_MEDICO_OPTIONS}
            value={value.servicioMedico}
            onChange={(v) => update('servicioMedico', v as ServicioMedico)}
          />
        </div>
        <label className="mk-field">
          <span className="mk-field__label">Número de hijas</span>
          <input
            type="number"
            min={0}
            max={30}
            value={value.numeroHijas}
            onChange={(e) => update('numeroHijas', e.target.value)}
          />
        </label>
        <label className="mk-field">
          <span className="mk-field__label">Número de hijos</span>
          <input
            type="number"
            min={0}
            max={30}
            value={value.numeroHijosHombres}
            onChange={(e) => update('numeroHijosHombres', e.target.value)}
          />
        </label>
      </div>

      {value.servicioMedico === 'otro' ? (
        <label className="mk-field">
          <span className="mk-field__label">Especificar servicio médico *</span>
          <input
            type="text"
            maxLength={100}
            value={value.servicioMedicoOtro}
            onChange={(e) => update('servicioMedicoOtro', e.target.value)}
          />
        </label>
      ) : null}

      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-on-surface-variant">Servicios solicitados *</span>
        <MultiSelect
          label="Servicios solicitados *"
          placeholder="Selecciona una o más áreas…"
          options={areaOptions}
          value={value.serviciosSolicitadosAreaIds.map(String)}
          onChange={(vals) => update('serviciosSolicitadosAreaIds', vals.map(Number))}
        />
      </div>

      <div className="grid gap-2 rounded-2xl bg-surface-container-low p-4 sm:grid-cols-2">
        <GlassSwitch
          checked={value.tieneTrabajo}
          onChange={(checked) => update('tieneTrabajo', checked)}
        >
          Cuenta con trabajo remunerado
        </GlassSwitch>
        <GlassSwitch
          checked={value.tieneEmbarazo}
          onChange={(checked) => update('tieneEmbarazo', checked)}
        >
          Embarazo actual
        </GlassSwitch>
        <GlassSwitch
          checked={value.tieneDenuncia}
          onChange={(checked) => update('tieneDenuncia', checked)}
        >
          Cuenta con denuncia previa
        </GlassSwitch>
        <GlassSwitch
          checked={value.esVictimaDelito}
          onChange={(checked) => update('esVictimaDelito', checked)}
        >
          Víctima de delito
        </GlassSwitch>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary-container/25 p-4">
        <GlassSwitch
          checked={value.avisoPrivacidadAceptado}
          onChange={(checked) => update('avisoPrivacidadAceptado', checked)}
        >
          <span className="font-medium text-on-surface">
            La usuaria aceptó el Aviso de Privacidad Simplificado (RNF-04) *
          </span>
        </GlassSwitch>
      </div>
    </div>
  );
}
