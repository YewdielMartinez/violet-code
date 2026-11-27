import { useEffect, useMemo, useState } from 'react';
import { Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/select';
import type { AgresorValidationField, AsentamientoOpcion } from './agresorApi';
import { AnimatedReveal } from './agresor/AnimatedReveal';
import { AgresorGlassSwitch } from './agresor/motionCompat';

/** Espera máxima antes de cargar el catálogo completo si nadie toca el selector (ms). */
const CATALOGO_IDLE_TIMEOUT_MS = 600;

/**
 * El catálogo de Ahome trae cientos de asentamientos y el `Select` del kit crea un botón (con su SVG) por opción,
 * dos veces. Hacerlo al montar el formulario es lo más caro de la apertura, así que se monta con las opciones
 * mínimas (vacía + la elegida) y el catálogo completo entra cuando el navegador queda libre o apenas la persona
 * enfoca / presiona el selector (siempre antes de que el kit abra su menú).
 */
function useCatalogoListo(): [boolean, () => void] {
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (listo) return;
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setListo(true), { timeout: CATALOGO_IDLE_TIMEOUT_MS });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setListo(true), 200);
    return () => window.clearTimeout(id);
  }, [listo]);

  return [listo, () => setListo(true)];
}

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
  const [modoCpManual, setModoCpManual] = useState(
    () => values.asentamientoId === null && values.codigoPostal.trim().length > 0,
  );

  const [catalogoListo, cargarCatalogo] = useCatalogoListo();

  const asentamientoOptions = useMemo(() => {
    const sinEspecificar = { value: '', label: 'Sin especificar colonia' };
    const toOption = (item: AsentamientoOpcion) => ({
      value: String(item.id),
      label: `${item.nombre} (${item.tipoAsentamiento} · CP ${item.codigoPostal})`,
    });
    if (catalogoListo) return [sinEspecificar, ...asentamientos.map(toOption)];
    const elegido = asentamientos.find((a) => a.id === values.asentamientoId);
    return elegido ? [sinEspecificar, toOption(elegido)] : [sinEspecificar];
  }, [asentamientos, catalogoListo, values.asentamientoId]);

  const selectedAsentamiento = asentamientos.find((a) => a.id === values.asentamientoId);

  function handleToggleCpManual(manual: boolean) {
    setModoCpManual(manual);
    if (manual) {
      onPatch({ asentamientoId: null });
    } else {
      onPatch({ codigoPostal: '' });
    }
  }

  return (
    <fieldset className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-low p-5 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
        Domicilio
      </legend>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
        <AgresorGlassSwitch
          checked={modoCpManual}
          label="Domicilio fuera de Ahome"
          onChange={handleToggleCpManual}
          className="text-sm font-medium text-on-surface"
        >
          Domicilio fuera de Ahome (capturar CP manual)
        </AgresorGlassSwitch>
      </div>

      <AnimatedReveal show={!modoCpManual} className="sm:col-span-2">
        <div
          className="grid gap-1"
          onFocusCapture={cargarCatalogo}
          onPointerDownCapture={cargarCatalogo}
        >
          <span className="text-sm font-medium text-on-surface-variant">
            Colonia / Asentamiento (Ahome)
          </span>
          <Select
            size="lg"
            label="Colonia o asentamiento"
            options={asentamientoOptions}
            value={values.asentamientoId ? String(values.asentamientoId) : ''}
            onChange={(val) => {
              const nextId = val ? Number(val) : null;
              onPatch({ asentamientoId: nextId, ...(nextId !== null ? { codigoPostal: '' } : {}) });
            }}
          />
          {selectedAsentamiento ? (
            <p className="text-sm text-on-surface-variant">
              CP del catálogo: <span className="font-mono">{selectedAsentamiento.codigoPostal}</span>
            </p>
          ) : null}
        </div>
      </AnimatedReveal>

      <AnimatedReveal show={modoCpManual} className="sm:col-span-2">
        <div className="grid gap-1">
          <label className="text-sm font-medium text-on-surface-variant">
            Código postal manual (5 dígitos, fuera de catálogo)
          </label>
          <label className="mk-field">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={values.codigoPostal}
              aria-invalid={errores.codigoPostal ? true : undefined}
              placeholder="Ej. 81200"
              onChange={(e) =>
                onPatch({ codigoPostal: e.target.value.replace(/\D/g, '').slice(0, 5) })
              }
            />
          </label>
          {errores.codigoPostal ? (
            <p role="alert" className="text-sm text-status-danger">
              {errores.codigoPostal}
            </p>
          ) : null}
        </div>
      </AnimatedReveal>

      <div className="grid gap-1 sm:col-span-2">
        <label className="text-sm font-medium text-on-surface-variant">Calle</label>
        <label className="mk-field">
          <input
            type="text"
            maxLength={150}
            value={values.calle}
            onChange={(e) => onPatch({ calle: e.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-1">
        <label className="text-sm font-medium text-on-surface-variant">Número exterior</label>
        <label className="mk-field">
          <input
            type="text"
            maxLength={30}
            value={values.numeroExterior}
            onChange={(e) => onPatch({ numeroExterior: e.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-1">
        <label className="text-sm font-medium text-on-surface-variant">Número interior</label>
        <label className="mk-field">
          <input
            type="text"
            maxLength={30}
            value={values.numeroInterior}
            onChange={(e) => onPatch({ numeroInterior: e.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-1 sm:col-span-2">
        <label className="text-sm font-medium text-on-surface-variant">Referencias</label>
        <label className="mk-field">
          <input
            type="text"
            maxLength={250}
            value={values.referencias}
            onChange={(e) => onPatch({ referencias: e.target.value })}
          />
        </label>
      </div>
    </fieldset>
  );
}
