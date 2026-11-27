import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { DateTimePicker, Dialog, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/date-time-picker';
import '@yewdiel21/motion-kit/css/components/range-calendar';
import '@yewdiel21/motion-kit/css/components/time-field';
import '@yewdiel21/motion-kit/css/components/popover';
import {
  NIVEL_EDUCATIVO_LABELS,
  TIPO_INSTITUCION_LABELS,
  validateActividadCampos,
  type ActividadErrores,
  type ActividadPreventivaCreateInput,
  type NivelEducativo,
  type TipoInstitucionActividad,
} from '@/domain/models/ActividadPreventiva';
import { ROLE_LABELS, type StaffRole } from '@/domain/models/Auth';
import type { AsentamientoSepomex } from '@/domain/models/Domicilio';
import { useAsentamientosSepomex } from '@/features/expedientes/api';
import { useDialogSettled } from '@/shared/hooks/useDialogSettled';
import { useEmpleadosParticipantes, useRegistrarActividadPreventiva, useTiposActividad } from './api';
import { ColoniaSearchField } from './ColoniaSearchField';
import { aIsoMazatlan, fechaLargaActividad, horaActividad, mensajeError } from './actividadesList';

/** Monta el selector de fecha a ~60 % del morph de apertura (ver `useDialogSettled`): es lo más pesado del formulario. */
const PICKER_MAX_WAIT_MS = 420;

const TIPOS_INSTITUCION = Object.keys(TIPO_INSTITUCION_LABELS) as TipoInstitucionActividad[];
const NIVELES = Object.keys(NIVEL_EDUCATIVO_LABELS) as NivelEducativo[];

const CHIP_ON = 'bg-secondary-container text-on-secondary-container';
const INPUT_CLASS =
  'w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-status-danger';

const GHOST_FMT = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' });

/** Marcador estático con la misma caja que el `DateTimePicker` del kit: sin salto al montar. */
function FechaHoraGhost({ value }: { value: Date | null }) {
  return (
    <div aria-hidden className="act-dt-ghost">
      <span>{value ? GHOST_FMT.format(value) : 'dd/mm/aaaa, --:--'}</span>
    </div>
  );
}

/** Mañana a las 09:00 (hora de pared): lo habitual al programar una visita. */
function fechaInicial(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 9, 0);
}

function Campo({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium text-on-surface">{label}</span>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-status-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
}

interface FormState {
  titulo: string;
  tipoActividadId: number;
  tipoInstitucion: TipoInstitucionActividad | '';
  nivelEducativo: NivelEducativo | '';
  sede: string;
  direccion: string;
  referencias: string;
  asistentes: string;
  cuando: Date | null;
  colonia: AsentamientoSepomex | null;
  participantes: readonly string[];
}

const ESTADO_INICIAL = (): FormState => ({
  titulo: '',
  tipoActividadId: 0,
  tipoInstitucion: '',
  nivelEducativo: '',
  sede: '',
  direccion: '',
  referencias: '',
  asistentes: '',
  cuando: fechaInicial(),
  colonia: null,
  participantes: [],
});

export interface ActividadCrearFormProps {
  onCancel: () => void;
  /** La actividad se registró: el diálogo se cierra y la lista se refresca por la invalidación de la mutación. */
  onCreated: () => void;
}

/** Formulario «Nueva actividad» (`RF-16`): programa o registra una visita/capacitación en una escuela, empresa o comunidad. */
export function ActividadCrearForm({ onCancel, onCreated }: ActividadCrearFormProps) {
  const formId = useId();
  const pickerListo = useDialogSettled(PICKER_MAX_WAIT_MS);
  const tiposQuery = useTiposActividad();
  const empleadosQuery = useEmpleadosParticipantes(pickerListo);
  const asentamientosQuery = useAsentamientosSepomex(undefined, pickerListo);
  const registrar = useRegistrarActividadPreventiva();

  const [form, setForm] = useState<FormState>(ESTADO_INICIAL);
  const [errores, setErrores] = useState<ActividadErrores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const pending = registrar.isPending;

  const patch = (cambios: Partial<FormState>) => setForm((prev) => ({ ...prev, ...cambios }));
  const asentamientos = useMemo(() => asentamientosQuery.data ?? [], [asentamientosQuery.data]);

  function construirInput(): ActividadPreventivaCreateInput {
    const asistentes = form.asistentes.trim();
    return {
      titulo: form.titulo,
      tipoActividadId: form.tipoActividadId,
      tipoInstitucion: form.tipoInstitucion || ('' as TipoInstitucionActividad),
      nivelEducativo: form.tipoInstitucion === 'escuela' ? form.nivelEducativo || null : null,
      sede: form.sede,
      direccion: form.direccion.trim() || null,
      referencias: form.referencias.trim() || null,
      asentamientoId: form.colonia?.id ?? null,
      programadaEn: form.cuando ? aIsoMazatlan(form.cuando) : '',
      numeroAsistentes: asistentes === '' ? null : Number(asistentes),
      participantesIds: [...form.participantes],
    };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const input = construirInput();
    const invalidos = validateActividadCampos(input);
    setErrores(invalidos);
    if (Object.keys(invalidos).length > 0) {
      setErrorGeneral('Revisa los campos marcados.');
      return;
    }
    setErrorGeneral(null);
    try {
      await registrar.mutateAsync(input);
      toast(`Actividad registrada: ${fechaLargaActividad(input.programadaEn)}, ${horaActividad(input.programadaEn)}.`, {
        tone: 'success',
      });
      onCreated();
    } catch (err) {
      const message = mensajeError(err, 'No se pudo registrar la actividad.');
      setErrorGeneral(message);
      toast(message, { tone: 'error' });
    }
  }

  function alternarParticipante(id: string) {
    setForm((prev) => ({
      ...prev,
      participantes: prev.participantes.includes(id)
        ? prev.participantes.filter((p) => p !== id)
        : [...prev.participantes, id],
    }));
  }

  return (
    <>
      <Dialog.Body className="vc-dlg-view" data-dir="none">
        <form id={formId} noValidate onSubmit={onSubmit} className="grid gap-5" aria-label="Nueva actividad">
          <Campo label="Título *" error={errores.titulo}>
            <input
              type="text"
              aria-label="Título de la actividad"
              aria-invalid={errores.titulo ? true : undefined}
              maxLength={200}
              disabled={pending}
              value={form.titulo}
              onChange={(e) => patch({ titulo: e.target.value })}
              placeholder="Ej. Violencia en el noviazgo"
              className={INPUT_CLASS}
            />
          </Campo>

          <Campo label="Tipo de actividad *" error={errores.tipoActividadId}>
            <div role="radiogroup" aria-label="Tipo de actividad" className="flex flex-wrap gap-2">
              {tiposQuery.isLoading ? <span className="text-sm text-on-surface-variant">Cargando tipos…</span> : null}
              {tiposQuery.isError ? <span className="text-sm text-status-danger">No se pudo cargar el catálogo.</span> : null}
              {(tiposQuery.data ?? []).map((tipo) => (
                <button
                  key={tipo.id}
                  type="button"
                  role="radio"
                  aria-checked={form.tipoActividadId === tipo.id}
                  disabled={pending}
                  onClick={() => patch({ tipoActividadId: tipo.id })}
                  className={`mk-chip mk-chip--filter vc-press ${form.tipoActividadId === tipo.id ? CHIP_ON : ''}`}
                >
                  {tipo.nombre}
                </button>
              ))}
            </div>
          </Campo>

          <Campo label="Tipo de institución *" error={errores.tipoInstitucion}>
            <div role="radiogroup" aria-label="Tipo de institución" className="flex flex-wrap gap-2">
              {TIPOS_INSTITUCION.map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  role="radio"
                  aria-checked={form.tipoInstitucion === tipo}
                  disabled={pending}
                  onClick={() => patch({ tipoInstitucion: tipo, ...(tipo !== 'escuela' ? { nivelEducativo: '' } : {}) })}
                  className={`mk-chip mk-chip--filter vc-press ${form.tipoInstitucion === tipo ? CHIP_ON : ''}`}
                >
                  {TIPO_INSTITUCION_LABELS[tipo]}
                </button>
              ))}
            </div>
          </Campo>

          {form.tipoInstitucion === 'escuela' ? (
            <div className="act-reveal">
              <Campo label="Nivel educativo (opcional)" error={errores.nivelEducativo}>
                <div role="radiogroup" aria-label="Nivel educativo" className="flex flex-wrap gap-2">
                  {NIVELES.map((nivel) => (
                    <button
                      key={nivel}
                      type="button"
                      role="radio"
                      aria-checked={form.nivelEducativo === nivel}
                      disabled={pending}
                      onClick={() => patch({ nivelEducativo: form.nivelEducativo === nivel ? '' : nivel })}
                      className={`mk-chip mk-chip--filter vc-press ${form.nivelEducativo === nivel ? CHIP_ON : ''}`}
                    >
                      {NIVEL_EDUCATIVO_LABELS[nivel]}
                    </button>
                  ))}
                </div>
              </Campo>
            </div>
          ) : null}

          <Campo
            label="Sede *"
            error={errores.sede}
            hint="Nombre de la escuela, empresa, dependencia, parque o recinto."
          >
            <input
              type="text"
              aria-label="Sede de la actividad"
              aria-invalid={errores.sede ? true : undefined}
              maxLength={200}
              disabled={pending}
              value={form.sede}
              onChange={(e) => patch({ sede: e.target.value })}
              placeholder="Ej. Escuela Secundaria Técnica 12"
              className={INPUT_CLASS}
            />
          </Campo>

          <Campo label="Fecha y hora *" error={errores.programadaEn} hint="Hora de Mazatlán. Se registra como pendiente; si la fecha ya pasó, ciérrala como realizada desde su detalle.">
            {pickerListo ? (
              <DateTimePicker
                label="Fecha y hora de la actividad"
                value={form.cuando}
                minuteStep={15}
                hourCycle={24}
                locale="es-MX"
                disabled={pending}
                onChange={(cuando) => patch({ cuando })}
              />
            ) : (
              <FechaHoraGhost value={form.cuando} />
            )}
          </Campo>

          <Campo label="Colonia">
            <ColoniaSearchField
              value={form.colonia}
              onChange={(colonia) => patch({ colonia })}
              asentamientos={asentamientos}
              loading={asentamientosQuery.isLoading}
              disabled={pending}
            />
          </Campo>

          <div className="grid gap-5 sm:grid-cols-2">
            <Campo label="Dirección (opcional)" error={errores.direccion}>
              <input
                type="text"
                aria-label="Dirección"
                aria-invalid={errores.direccion ? true : undefined}
                maxLength={250}
                disabled={pending}
                value={form.direccion}
                onChange={(e) => patch({ direccion: e.target.value })}
                className={INPUT_CLASS}
              />
            </Campo>
            <Campo label="Referencias (opcional)" error={errores.referencias}>
              <input
                type="text"
                aria-label="Referencias"
                aria-invalid={errores.referencias ? true : undefined}
                maxLength={250}
                disabled={pending}
                value={form.referencias}
                onChange={(e) => patch({ referencias: e.target.value })}
                placeholder="Entre calles, auditorio, aula…"
                className={INPUT_CLASS}
              />
            </Campo>
          </div>

          <Campo label="Número de asistentes (opcional)" error={errores.numeroAsistentes} hint="Esperados; al marcarla como realizada registrarás los que asistieron.">
            <input
              type="number"
              inputMode="numeric"
              aria-label="Número de asistentes"
              aria-invalid={errores.numeroAsistentes ? true : undefined}
              min={0}
              max={10000}
              step={1}
              disabled={pending}
              value={form.asistentes}
              onChange={(e) => patch({ asistentes: e.target.value })}
              className={`${INPUT_CLASS} sm:max-w-48`}
            />
          </Campo>

          <Campo label="Personal que participa (opcional)">
            <div role="group" aria-label="Personal que participa" className="flex flex-wrap gap-2">
              {empleadosQuery.isLoading || !pickerListo ? (
                <span className="text-sm text-on-surface-variant">Cargando personal…</span>
              ) : null}
              {empleadosQuery.isError ? (
                <span className="text-sm text-status-danger">No se pudo cargar el personal.</span>
              ) : null}
              {(empleadosQuery.data ?? []).map((empleado) => {
                const on = form.participantes.includes(empleado.id);
                return (
                  <button
                    key={empleado.id}
                    type="button"
                    aria-pressed={on}
                    disabled={pending}
                    title={ROLE_LABELS[empleado.rol as StaffRole] ?? empleado.rol}
                    onClick={() => alternarParticipante(empleado.id)}
                    className={`mk-chip mk-chip--filter vc-press ${on ? CHIP_ON : ''}`}
                  >
                    {empleado.nombre}
                  </button>
                );
              })}
            </div>
          </Campo>

          {errorGeneral ? (
            <p role="alert" className="text-sm text-status-danger">
              {errorGeneral}
            </p>
          ) : null}
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <button type="button" className="mk-button mk-button--text vc-press" disabled={pending} onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" form={formId} className="mk-button mk-button--filled vc-press" disabled={pending}>
          {pending ? 'Guardando…' : 'Registrar actividad'}
        </button>
      </Dialog.Footer>
    </>
  );
}
