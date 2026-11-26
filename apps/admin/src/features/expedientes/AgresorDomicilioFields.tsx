import { useMemo } from 'react';
import { Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/select';
import type { AgresorValidationField, AsentamientoOpcion } from './agresorApi';

export interface DomicilioValues {
  asentamientoId: number | null;
  codigoPostal: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  referencias: string;
}

interface Props {
  asentamientos: AsentamientoOpcion[];
  values: DomicilioValues;
  errores: Partial<Record<AgresorValidationField, string>>;
  onPatch: (patch: Partial<DomicilioValues>) => void;
}

export function AgresorDomicilioFields({ asentamientos, values, errores, onPatch }: Props) {
  const asentamientoOptions = useMemo(
    () => [
      { value: '', label: 'Sin colonia del catálogo (capturar CP manual)' },
      ...asentamientos.map((item) => ({
        value: String(item.id),
        label: `${item.nombre} (${item.tipoAsentamiento} · CP ${item.codigoPostal})`,
      })),
    ],
    [asentamientos],
  );

  const selectedAsentamiento = asentamientos.find((a) => a.id === values.asentamientoId);

  return (
    <fieldset className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4 sm:grid-cols-2">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        Domicilio
      </legend>

      <div className="grid gap-1 sm:col-span-2">
        <span className="text-xs font-medium text-on-surface-variant">
          Colonia / Asentamiento (Ahome)
        </span>
        <Select
          label="Colonia o asentamiento"
          options={asentamientoOptions}
          value={values.asentamientoId ? String(values.asentamientoId) : ''}
          onChange={(val) => {
            const nextId = val ? Number(val) : null;
            onPatch({ asentamientoId: nextId, ...(nextId !== null ? { codigoPostal: '' } : {}) });
          }}
        />
        {selectedAsentamiento ? (
          <p className="text-xs text-on-surface-variant">
            CP del catálogo: <span className="font-mono">{selectedAsentamiento.codigoPostal}</span>
          </p>
        ) : null}
      </div>

      {values.asentamientoId === null ? (
        <div className="grid gap-1 sm:col-span-2">
          <label className="text-xs font-medium text-on-surface-variant">
            Código postal manual (5 dígitos, fuera de catálogo)
          </label>
          <label className="mk-field">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={values.codigoPostal}
              placeholder="Ej. 81200"
              onChange={(e) => onPatch({ codigoPostal: e.target.value.replace(/\D/g, '').slice(0, 5) })}
            />
          </label>
          {errores.codigoPostal ? (
            <p role="alert" className="text-xs text-status-danger">{errores.codigoPostal}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-1 sm:col-span-2">
        <label className="text-xs font-medium text-on-surface-variant">Calle</label>
        <label className="mk-field">
          <input type="text" maxLength={150} value={values.calle} onChange={(e) => onPatch({ calle: e.target.value })} />
        </label>
      </div>

      <div className="grid gap-1">
        <label className="text-xs font-medium text-on-surface-variant">Número exterior</label>
        <label className="mk-field">
          <input type="text" maxLength={30} value={values.numeroExterior} onChange={(e) => onPatch({ numeroExterior: e.target.value })} />
        </label>
      </div>

      <div className="grid gap-1">
        <label className="text-xs font-medium text-on-surface-variant">Número interior</label>
        <label className="mk-field">
          <input type="text" maxLength={30} value={values.numeroInterior} onChange={(e) => onPatch({ numeroInterior: e.target.value })} />
        </label>
      </div>

      <div className="grid gap-1 sm:col-span-2">
        <label className="text-xs font-medium text-on-surface-variant">Referencias</label>
        <label className="mk-field">
          <input type="text" maxLength={250} value={values.referencias} onChange={(e) => onPatch({ referencias: e.target.value })} />
        </label>
      </div>
    </fieldset>
  );
}
