import { memo, useId, useMemo, useState } from 'react';
import { Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/select';
import type { DomicilioInput } from '@/domain/models/Domicilio';
import { ESTADO_CIVIL_LABELS, type CatalogoItem, type EstadoCivil } from '@/domain/models/FichaRegistro';
import { Icon } from '@/shared/ui/Icon';
import { useAsentamientosPorCp } from './api';
import type { SeguimientoFormState } from './seguimientoFormModel';

type CopiaPatch = Partial<
  Pick<SeguimientoFormState, 'estadoCivil' | 'ocupacionId' | 'ocupacionOtra' | 'celular' | 'domicilio'>
>;

interface Props {
  state: SeguimientoFormState;
  ocupaciones: readonly CatalogoItem[];
  /** CP del domicilio vigente (también el del asentamiento del catálogo) para listar sus colonias. */
  codigoPostalInicial: string | null;
  disabled: boolean;
  onChange: (patch: CopiaPatch) => void;
}

const ESTADO_CIVIL_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  ...(Object.keys(ESTADO_CIVIL_LABELS) as EstadoCivil[]).map((value) => ({
    value,
    label: ESTADO_CIVIL_LABELS[value],
  })),
];

const INPUT_CLASS =
  'w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60';

/**
 * Copia por sesión de estado civil, ocupación, celular y domicilio (`atencion`).
 * Se guarda como historial del día; no reemplaza los datos de la Ficha Única.
 */
export const HojaCopiaFields = memo(function HojaCopiaFields({
  state,
  ocupaciones,
  codigoPostalInicial,
  disabled,
  onChange,
}: Props) {
  const celularId = useId();
  const otraId = useId();
  const cpId = useId();
  const calleId = useId();
  const extId = useId();
  const intId = useId();
  const refId = useId();

  const dom = state.domicilio;
  const [cpBusqueda, setCpBusqueda] = useState(codigoPostalInicial ?? '');
  const asentamientosQuery = useAsentamientosPorCp(cpBusqueda);
  const asentamientos = useMemo(() => asentamientosQuery.data ?? [], [asentamientosQuery.data]);

  const ocupacionOptions = useMemo(
    () => [
      { value: '', label: 'Sin especificar' },
      ...ocupaciones.map((o) => ({ value: String(o.id), label: o.nombre })),
    ],
    [ocupaciones],
  );
  const esOtra = ocupaciones.find((o) => o.id === state.ocupacionId)?.clave === 'otra';

  const asentamientoOptions = useMemo(
    () => [
      { value: '', label: asentamientos.length ? 'Selecciona la colonia' : 'CP fuera del catálogo' },
      ...asentamientos.map((a) => ({ value: String(a.id), label: `${a.nombre} (${a.tipoAsentamiento})` })),
    ],
    [asentamientos],
  );

  const setDom = (patch: Partial<DomicilioInput>) => onChange({ domicilio: { ...dom, ...patch } });

  return (
    <fieldset className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
      <legend className="px-1 text-sm font-medium text-on-surface">Datos del día</legend>
      <p className="flex items-start gap-2 text-xs text-on-surface-variant">
        <Icon name="history" className="mt-0.5 shrink-0 text-base text-primary" />
        <span>
          Se precargan desde la Ficha Única. Corrígelos si cambiaron: se guarda una copia con esta sesión
          como historial (los datos pueden cambiar entre sesiones) y la Ficha Única no se modifica.
        </span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Estado civil"
          options={ESTADO_CIVIL_OPTIONS}
          value={state.estadoCivil}
          disabled={disabled}
          onChange={(v) => onChange({ estadoCivil: v as EstadoCivil | '' })}
        />
        <div>
          <label htmlFor={celularId} className="mb-1.5 block text-sm font-medium text-on-surface">
            Celular
          </label>
          <input
            id={celularId}
            type="tel"
            inputMode="numeric"
            maxLength={10}
            disabled={disabled}
            value={state.celular}
            onChange={(e) => onChange({ celular: e.target.value.replace(/\D/g, '') })}
            placeholder="10 dígitos"
            className={INPUT_CLASS}
          />
        </div>
        <Select
          label="Ocupación"
          options={ocupacionOptions}
          value={state.ocupacionId ? String(state.ocupacionId) : ''}
          disabled={disabled}
          onChange={(v) => onChange({ ocupacionId: v ? Number(v) : null })}
        />
        {esOtra ? (
          <div>
            <label htmlFor={otraId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Especifica la ocupación
            </label>
            <input
              id={otraId}
              type="text"
              maxLength={150}
              disabled={disabled}
              value={state.ocupacionOtra}
              onChange={(e) => onChange({ ocupacionOtra: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={cpId} className="mb-1.5 block text-sm font-medium text-on-surface">
            Código postal
          </label>
          <input
            id={cpId}
            type="text"
            inputMode="numeric"
            maxLength={5}
            disabled={disabled}
            value={cpBusqueda}
            onChange={(e) => {
              const cp = e.target.value.replace(/\D/g, '');
              setCpBusqueda(cp);
              setDom({ asentamientoId: null, codigoPostalForaneo: cp });
            }}
            className={INPUT_CLASS}
          />
        </div>
        <div className="sm:col-span-2">
          <Select
            label="Colonia / asentamiento"
            options={asentamientoOptions}
            value={dom.asentamientoId ? String(dom.asentamientoId) : ''}
            disabled={disabled || asentamientos.length === 0}
            onChange={(v) =>
              setDom(
                v
                  ? { asentamientoId: Number(v), codigoPostalForaneo: '' }
                  : { asentamientoId: null, codigoPostalForaneo: cpBusqueda },
              )
            }
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={calleId} className="mb-1.5 block text-sm font-medium text-on-surface">
            Calle
          </label>
          <input
            id={calleId}
            type="text"
            maxLength={150}
            disabled={disabled}
            value={dom.calle}
            onChange={(e) => setDom({ calle: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={extId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Núm. ext.
            </label>
            <input
              id={extId}
              type="text"
              maxLength={30}
              disabled={disabled}
              value={dom.numeroExterior}
              onChange={(e) => setDom({ numeroExterior: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor={intId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Núm. int.
            </label>
            <input
              id={intId}
              type="text"
              maxLength={30}
              disabled={disabled}
              value={dom.numeroInterior}
              onChange={(e) => setDom({ numeroInterior: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
        </div>
        <div className="sm:col-span-3">
          <label htmlFor={refId} className="mb-1.5 block text-sm font-medium text-on-surface">
            Referencias
          </label>
          <input
            id={refId}
            type="text"
            maxLength={250}
            disabled={disabled}
            value={dom.referencias}
            onChange={(e) => setDom({ referencias: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      </div>
    </fieldset>
  );
});
