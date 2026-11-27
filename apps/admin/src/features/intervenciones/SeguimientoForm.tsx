import { useCallback, useId, useMemo, useState, type FormEvent } from 'react';
import { LoadingButton, Select, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/select';
import {
  ESTADO_CITA_LABELS,
  PRIORIDAD_CITA_LABELS,
  validarTransicionCita,
  type AgendaItem,
  type PrioridadNivel,
} from '@/domain/models/Cita';
import {
  ASISTENCIA_LABELS,
  citaAdmiteHojaSeguimiento,
  type AsistenciaCita,
  type ContextoHojaSeguimiento,
} from '@/domain/models/HojaSeguimiento';
import { Icon } from '@/shared/ui/Icon';
import { HojaCopiaFields } from './HojaCopiaFields';
import {
  traducirErrorIntervencion,
  useCambiarEstadoCita,
  useOcupaciones,
  useRegistrarSeguimiento,
  useTiposAtencion,
} from './api';
import {
  buildSeguimientoInput,
  initialSeguimientoForm,
  type SeguimientoFormState,
} from './seguimientoFormModel';

export interface SeguimientoFormProps {
  cita: AgendaItem;
  contexto: ContextoHojaSeguimiento;
  areaId: number | null;
  /** Solo Jurídico agenda directo la siguiente cita (`RN-04`). */
  permiteAgendar: boolean;
  onDone: () => void;
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

const ASISTENCIAS: readonly AsistenciaCita[] = ['asistio', 'no_asistio'];
const PRIORIDADES: readonly PrioridadNivel[] = ['alta', 'media', 'baja'];
const LOADING_LABELS = { loading: 'Guardando…', success: 'Guardado', error: 'Revisa los datos' };
const TEXTAREA_CLASS =
  'w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60';

/**
 * Hoja de seguimiento por cita (`RF-09`, `RN-13`): asistencia, tipo de atención, acciones,
 * próxima acción, prioridad y copia histórica de los datos del día.
 */
export function SeguimientoForm({ cita, contexto, areaId, permiteAgendar, onDone }: SeguimientoFormProps) {
  const accionesId = useId();
  const proximaId = useId();
  const obsId = useId();
  const citaFechaId = useId();

  const [state, setState] = useState<SeguimientoFormState>(() => initialSeguimientoForm(contexto));
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);

  const tiposQuery = useTiposAtencion(areaId);
  const ocupacionesQuery = useOcupaciones();
  const registrar = useRegistrarSeguimiento();
  const cambiarEstado = useCambiarEstadoCita();

  const isBusy = submitState === 'loading';
  const editable = citaAdmiteHojaSeguimiento(cita.estado);

  const tipoOptions = useMemo(
    () => [
      { value: '', label: tiposQuery.isLoading ? 'Cargando…' : 'Selecciona el tipo' },
      ...(tiposQuery.data ?? []).map((t) => ({ value: String(t.id), label: t.nombre })),
    ],
    [tiposQuery.data, tiposQuery.isLoading],
  );

  const patch = useCallback((next: Partial<SeguimientoFormState>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  async function registrarInasistencia() {
    const transicion = validarTransicionCita(cita.estado, 'no_asistio');
    if (transicion) throw new Error(transicion);
    await cambiarEstado.mutateAsync({ citaId: cita.citaId, estado: 'no_asistio' });
    toast('Inasistencia registrada en la cita.', { tone: 'success' });
  }

  async function registrarHoja() {
    const built = buildSeguimientoInput(state, { ctx: contexto, citaId: cita.citaId, permiteAgendar });
    if (built.error !== null) throw new Error(built.error);
    const result = await registrar.mutateAsync(built.input);
    toast(
      result.esPrimeraVezArea
        ? 'Hoja de seguimiento registrada (primera vez en tu área).'
        : 'Hoja de seguimiento registrada.',
      { tone: 'success' },
    );
    if (result.copiaGuardada === false) {
      toast('La hoja se guardó, pero no la copia de los datos del día. Avisa a soporte.', {
        tone: 'error',
        duration: 8000,
      });
    }
    if (result.citaProximaId) toast('Próxima cita agendada.', { tone: 'info' });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    setError(null);
    setSubmitState('loading');
    try {
      await (state.asistencia === 'no_asistio' ? registrarInasistencia() : registrarHoja());
      setSubmitState('success');
      onDone();
    } catch (err) {
      const message =
        err instanceof Error && !('code' in err)
          ? err.message
          : traducirErrorIntervencion(err, 'No se pudo guardar la hoja de seguimiento.');
      setError(message);
      setSubmitState('error');
      toast(message, { tone: 'error' });
    }
  }

  if (!editable) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
        <Icon name="info" className="mt-0.5 shrink-0 text-primary" />
        <p>
          Esta cita está en estado <strong>{ESTADO_CITA_LABELS[cita.estado]}</strong>. La hoja de
          seguimiento solo se registra sobre citas agendadas o confirmadas; consulta lo registrado en la
          línea de tiempo.
        </p>
      </div>
    );
  }

  const asistio = state.asistencia === 'asistio';

  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-5" aria-label="Hoja de seguimiento">
      <div role="radiogroup" aria-label="Asistencia a la cita" className="flex flex-wrap gap-2">
        {ASISTENCIAS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={state.asistencia === value}
            disabled={isBusy}
            onClick={() => patch({ asistencia: value })}
            className={`mk-chip mk-chip--filter inline-flex items-center gap-1.5 ${
              state.asistencia === value ? 'bg-secondary-container text-on-secondary-container' : ''
            }`}
          >
            <Icon name={value === 'asistio' ? 'how_to_reg' : 'person_off'} className="text-base" />
            <span>{ASISTENCIA_LABELS[value]}</span>
          </button>
        ))}
      </div>

      {asistio ? (
        <>
          <Select
            label="Tipo de atención *"
            options={tipoOptions}
            value={state.tipoAtencionId ? String(state.tipoAtencionId) : ''}
            disabled={isBusy || tiposQuery.isLoading}
            onChange={(v) => patch({ tipoAtencionId: v ? Number(v) : null })}
          />

          <div>
            <label htmlFor={accionesId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Acciones realizadas *
            </label>
            <textarea
              id={accionesId}
              rows={4}
              maxLength={5000}
              disabled={isBusy}
              value={state.accionesRealizadas}
              onChange={(e) => patch({ accionesRealizadas: e.target.value })}
              placeholder="¿Qué se hizo en la sesión?"
              className={TEXTAREA_CLASS}
            />
          </div>

          <div>
            <label htmlFor={proximaId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Próxima acción
            </label>
            <textarea
              id={proximaId}
              rows={2}
              maxLength={2000}
              disabled={isBusy}
              value={state.proximaAccion}
              onChange={(e) => patch({ proximaAccion: e.target.value })}
              placeholder="Ej. Canalizar a jurídico, solicitar cita con recepción en un mes…"
              className={TEXTAREA_CLASS}
            />
          </div>

          <div role="radiogroup" aria-label="Prioridad del caso" className="grid gap-2">
            <span className="text-sm font-medium text-on-surface">Prioridad del caso (opcional)</span>
            <div className="flex flex-wrap gap-2">
              {PRIORIDADES.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={state.prioridad === p}
                  disabled={isBusy}
                  onClick={() => patch({ prioridad: state.prioridad === p ? '' : p })}
                  className={`mk-chip mk-chip--filter ${
                    state.prioridad === p ? 'bg-primary-container text-on-primary-container' : ''
                  }`}
                >
                  {PRIORIDAD_CITA_LABELS[p]}
                </button>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant">
              La prioridad alta incluye el caso en la lista de urgencias para llamar.
            </p>
          </div>

          <div>
            <label htmlFor={obsId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Observaciones
            </label>
            <textarea
              id={obsId}
              rows={2}
              maxLength={5000}
              disabled={isBusy}
              value={state.observaciones}
              onChange={(e) => patch({ observaciones: e.target.value })}
              className={TEXTAREA_CLASS}
            />
          </div>

          <HojaCopiaFields
            state={state}
            ocupaciones={ocupacionesQuery.data ?? []}
            codigoPostalInicial={contexto.domicilio?.codigoPostal ?? null}
            disabled={isBusy}
            onChange={patch}
          />

          {permiteAgendar ? (
            <details className="rounded-2xl border border-outline-variant p-4">
              <summary className="cursor-pointer text-sm font-medium text-on-surface">
                Agendar próxima cita (opcional)
              </summary>
              <div className="mt-3">
                <label htmlFor={citaFechaId} className="mb-1.5 block text-sm text-on-surface-variant">
                  Fecha y hora (hora de Mazatlán)
                </label>
                <input
                  id={citaFechaId}
                  type="datetime-local"
                  disabled={isBusy}
                  value={state.proximaCitaLocal}
                  onChange={(e) => patch({ proximaCitaLocal: e.target.value })}
                  className={TEXTAREA_CLASS}
                />
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
          Se marcará la cita como «No asistió». No se genera hoja de seguimiento; la persona aparecerá
          así en la agenda para reagendar.
        </p>
      )}

      {error ? (
        <p role="alert" className="text-sm text-status-danger">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <LoadingButton
          type="submit"
          state={submitState}
          labels={LOADING_LABELS}
          disabled={isBusy}
          className="mk-button mk-button--filled"
        >
          {asistio ? 'Registrar hoja de seguimiento' : 'Registrar inasistencia'}
        </LoadingButton>
      </div>
    </form>
  );
}
