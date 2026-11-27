import { useId, useMemo, useState, type FormEvent } from 'react';
import { Dialog, toast } from '@yewdiel21/motion-kit/react';
import { PRIORIDAD_CITA_LABELS, validateCitaCreate, type OrigenCita, type PrioridadNivel } from '@/domain/models/Cita';
import { formatHora } from '@/features/intervenciones/formatters';
import { useAuth } from '@/shared/auth/useAuth';
import { DialogSafeDateTimePicker } from '@/shared/ui/DialogSafeDateTimePicker';
import { Icon } from '@/shared/ui/Icon';
import { PersonaSearchField } from './PersonaSearchField';
import { useCrearCita } from './api';
import {
  PRIORIDADES,
  aIsoMazatlan,
  areaNombre,
  areasPermitidas,
  fechaInicialCita,
  fechaLargaCita,
  mensajeError,
  type CitaDir,
  type PersonaSeleccion,
} from './citaDialogUtils';
import { useAreasCita } from './personaSearchApi';
import { useDialogSettled } from './useDialogSettled';

/** Monta el selector de fecha a ~60 % del morph de apertura (ver `useDialogSettled`): es lo más pesado del formulario. */
const PICKER_MAX_WAIT_MS = 420;

const GHOST_FMT = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' });

/** Marcador estático con la misma caja que el `DateTimePicker` del kit (12 px de radio, 2.75 rem): sin salto al montar. */
function FechaHoraGhost({ value }: { value: Date | null }) {
  return (
    <div aria-hidden className="vc-cita-dt-ghost">
      <span>{value ? GHOST_FMT.format(value) : 'dd/mm/aaaa, --:--'}</span>
    </div>
  );
}

const CHIP_ON = 'bg-secondary-container text-on-secondary-container';
const INPUT_CLASS =
  'w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60';

export interface CitaCrearFormProps {
  fecha: Date;
  areaId?: number | null;
  persona?: PersonaSeleccion | null;
  dir: CitaDir;
  /** «Cancelar»: vuelve a la vista anterior o cierra el diálogo. */
  onCancel: () => void;
  /** La cita se creó: el diálogo se cierra y la agenda se refresca por la invalidación de `useCrearCita`. */
  onCreated: () => void;
}

/** Vista «crear»: alta de cita con persona existente, área (según rol), fecha/hora, prioridad y recomendación. */
export function CitaCrearForm({ fecha, areaId, persona: personaInicial, dir, onCancel, onCreated }: CitaCrearFormProps) {
  const formId = useId();
  const { user } = useAuth();
  const areasQuery = useAreasCita();
  const crear = useCrearCita();
  const pickerListo = useDialogSettled(PICKER_MAX_WAIT_MS);

  const [persona, setPersona] = useState<PersonaSeleccion | null>(personaInicial ?? null);
  const [areaElegida, setAreaElegida] = useState<number | null>(null);
  const [cuando, setCuando] = useState<Date | null>(() => fechaInicialCita(fecha));
  const [prioridad, setPrioridad] = useState<PrioridadNivel | ''>('');
  const [recomendada, setRecomendada] = useState('');
  const [umeca, setUmeca] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);

  const permitidas = useMemo(
    () => areasPermitidas(user?.role, areasQuery.data ?? []),
    [user?.role, areasQuery.data],
  );
  const area =
    areaElegida ??
    (permitidas.length === 1
      ? permitidas[0].id
      : areaId != null && permitidas.some((a) => a.id === areaId)
        ? areaId
        : null);
  const pending = crear.isPending;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setIntentado(true);
    const input = {
      personaId: persona?.id ?? '',
      areaId: area ?? 0,
      programadaEn: cuando ? aIsoMazatlan(cuando) : '',
      prioridad: prioridad || null,
      recomendadaPor: recomendada.trim() || null,
      origen: (umeca ? 'umeca' : 'regular') as OrigenCita,
    };
    const invalido = validateCitaCreate(input);
    if (invalido) {
      setError(invalido);
      return;
    }
    setError(null);
    try {
      const creada = await crear.mutateAsync(input);
      toast(`Cita agendada: ${fechaLargaCita(creada.programadaEn)}, ${formatHora(creada.programadaEn)}.`, {
        tone: 'success',
      });
      onCreated();
    } catch (err) {
      const message = mensajeError(err, 'No se pudo agendar la cita.');
      setError(message);
      toast(message, { tone: 'error' });
    }
  }

  const sinPersona = intentado && !persona;

  return (
    <>
      <Dialog.Body className="vc-cita-view" data-dir={dir}>
        <form id={formId} noValidate onSubmit={onSubmit} className="grid gap-5" aria-label="Nueva cita">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-on-surface">Persona *</span>
            <PersonaSearchField
              value={persona}
              onChange={setPersona}
              disabled={pending}
              error={sinPersona ? 'Selecciona la persona para agendar la cita.' : null}
            />
          </div>

          <div role="radiogroup" aria-label="Área de atención" className="grid gap-1.5">
            <span className="text-sm font-medium text-on-surface">Área de atención *</span>
            <div className="flex flex-wrap gap-2">
              {areasQuery.isLoading ? <span className="text-sm text-on-surface-variant">Cargando áreas…</span> : null}
              {permitidas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={area === a.id}
                  disabled={pending}
                  onClick={() => setAreaElegida(a.id)}
                  className={`mk-chip mk-chip--filter vc-cita-btn ${area === a.id ? CHIP_ON : ''}`}
                >
                  {areaNombre(a.clave)}
                </button>
              ))}
            </div>
            {user?.role === 'recepcion' ? (
              <p className="text-xs text-on-surface-variant">Recepción agenda en Trabajo Social, Psicología y Jurídico.</p>
            ) : user?.role === 'juridico' ? (
              <p className="text-xs text-on-surface-variant">Jurídico agenda únicamente en Jurídico.</p>
            ) : user?.role === 'psicologia' ? (
              <p className="text-xs text-on-surface-variant">Psicología agenda únicamente en Psicología.</p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-on-surface">Fecha y hora *</span>
            {pickerListo ? (
              <DialogSafeDateTimePicker
                label="Fecha y hora de la cita"
                value={cuando}
                minuteStep={15}
                hourCycle={24}
                locale="es-MX"
                disabled={pending}
                onChange={setCuando}
              />
            ) : (
              <FechaHoraGhost value={cuando} />
            )}
            <p className="text-xs text-on-surface-variant">Hora de Mazatlán.</p>
          </div>

          <div role="radiogroup" aria-label="Prioridad operativa" className="grid gap-1.5">
            <span className="text-sm font-medium text-on-surface">Prioridad operativa (opcional)</span>
            <div className="flex flex-wrap gap-2">
              {PRIORIDADES.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={prioridad === p}
                  disabled={pending}
                  onClick={() => setPrioridad(prioridad === p ? '' : p)}
                  className={`mk-chip mk-chip--filter vc-cita-btn ${prioridad === p ? 'bg-primary-container text-on-primary-container' : ''}`}
                >
                  {PRIORIDAD_CITA_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor={`${formId}-rec`} className="text-sm font-medium text-on-surface">
              Recomendada por (opcional)
            </label>
            <input
              id={`${formId}-rec`}
              type="text"
              maxLength={150}
              disabled={pending}
              value={recomendada}
              onChange={(e) => setRecomendada(e.target.value)}
              placeholder="Persona o institución que la recomendó"
              className={INPUT_CLASS}
            />
          </div>

          <label
            htmlFor={`${formId}-umeca`}
            className={`vc-cita-umeca flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
              umeca
                ? 'border-outline bg-tertiary-container text-on-tertiary-container'
                : 'border-outline-variant bg-surface-container-low text-on-surface'
            }`}
          >
            <input
              id={`${formId}-umeca`}
              type="checkbox"
              checked={umeca}
              disabled={pending}
              onChange={(e) => setUmeca(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
            />
            <span className="grid gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Icon name="gavel" className="text-[18px]" />
                Cita obligatoria (UMECA)
              </span>
              <span className={`text-xs ${umeca ? 'text-on-tertiary-container' : 'text-on-surface-variant'}`}>
                Marca la cita de una mujer cuya asistencia fue ordenada por un juzgado. UMECA podrá ver si asistió.
              </span>
            </span>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-status-danger">
              {error}
            </p>
          ) : null}
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <button type="button" className="mk-button mk-button--text vc-cita-btn" disabled={pending} onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" form={formId} className="mk-button mk-button--filled vc-cita-btn" disabled={pending}>
          {pending ? 'Agendando…' : 'Agendar cita'}
        </button>
      </Dialog.Footer>
    </>
  );
}
