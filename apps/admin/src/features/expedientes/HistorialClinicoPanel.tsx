import { memo, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, GlassSwitch, LoadingButton, Skeleton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/glass-switch';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { puedeAccederHistorialClinico } from '@/domain/models/FichaRegistro';
import {
  camposCambiados,
  puedeEscribirHistorialClinico,
  valorCampoHistorial,
  type HistorialClinico,
  type HistorialClinicoCampo,
} from '@/domain/models/HistorialClinico';
import type { EstadoFicha } from '@/domain/models/Persona';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import {
  handleExpedienteMutationError,
  useGuardarHistorialClinico,
  useHistorialClinico,
} from './api';
import { HistorialClinicoVersiones } from './HistorialClinicoVersiones';
import './historial-clinico.css';

export interface HistorialClinicoPanelProps {
  fichaId: string;
  estado?: EstadoFicha;
}

interface HistorialDraft {
  motivoConsulta: string;
  antecedentesPersonales: string;
  antecedentesFamiliares: string;
  tieneAtencionPsicologicaPrevia: boolean;
  observacionesIniciales: string;
}

function draftFromHistorial(historial: HistorialClinico | null | undefined): HistorialDraft {
  return {
    motivoConsulta: historial?.motivoConsulta ?? '',
    antecedentesPersonales: historial?.antecedentesPersonales ?? '',
    antecedentesFamiliares: historial?.antecedentesFamiliares ?? '',
    tieneAtencionPsicologicaPrevia: Boolean(historial?.tieneAtencionPsicologicaPrevia),
    observacionesIniciales: historial?.observacionesIniciales ?? '',
  };
}

type Direction = 'none' | 'forward' | 'back';

/** Debe coincidir con la duración de `.vc-hc-stage` en `historial-clinico.css`. */
const SAVED_BUTTON_MS = 520;
const MAX_LENGTH = 5000;

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];
const LOADING_LABELS = { loading: 'Guardando…', success: 'Guardado', error: 'No se guardó' };

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface ReadFieldProps {
  label: string;
  value: string | null | undefined;
  /** Posición en la cascada de entrada. */
  index: number;
  changed: boolean;
  wide?: boolean;
  featured?: boolean;
}

function ReadField({ label, value, index, changed, wide = false, featured = false }: ReadFieldProps) {
  const clean = value?.trim() || null;
  return (
    <div
      className="vc-hc-field"
      style={{ '--i': index } as CSSProperties}
      data-wide={wide ? 'true' : undefined}
      data-featured={featured ? 'true' : undefined}
      data-changed={changed ? 'true' : undefined}
    >
      <p className="vc-hc-field__label">{label}</p>
      {clean ? (
        <p className="vc-hc-field__value">{clean}</p>
      ) : (
        <p className="vc-hc-field__value vc-hc-field__value--empty">Sin registrar</p>
      )}
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  placeholder: string;
  value: string;
  disabled: boolean;
  index: number;
  onChange: (value: string) => void;
}

function TextAreaField({
  label,
  placeholder,
  value,
  disabled,
  index,
  onChange,
}: TextAreaFieldProps) {
  const nearLimit = value.length >= MAX_LENGTH - 1000;
  return (
    <label className="vc-hc-edit-field" style={{ '--i': index } as CSSProperties}>
      <span className="vc-hc-edit-field__label">{label}</span>
      <textarea
        rows={4}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="vc-hc-textarea"
      />
      {nearLimit ? (
        <span className="vc-hc-edit-field__count" data-warn={value.length >= MAX_LENGTH - 200 ? 'true' : undefined}>
          {value.length} / {MAX_LENGTH}
        </span>
      ) : null}
    </label>
  );
}

/**
 * Historial clínico psicológico del expediente (`RF-11`, `RF-12`).
 * Lectura: Titular, Subdirección y Psicología. Alta y edición: solo Psicología (`historial_clinico.escribir`).
 */
export const HistorialClinicoPanel = memo(function HistorialClinicoPanel({
  fichaId,
  estado,
}: HistorialClinicoPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const puedeAcceder = puedeAccederHistorialClinico(user?.role);
  const canEdit = puedeEscribirHistorialClinico(user?.role) && estado !== 'archivado';

  const historialQuery = useHistorialClinico(fichaId, puedeAcceder);
  const guardar = useGuardarHistorialClinico(fichaId);

  const [editing, setEditing] = useState(false);
  const [direction, setDirection] = useState<Direction>('none');
  const [draft, setDraft] = useState<HistorialDraft>(() => draftFromHistorial(null));
  /** Tras guardar: el botón muestra «Guardado» un instante antes de volver a la vista. */
  const [savedFlash, setSavedFlash] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [changed, setChanged] = useState<readonly HistorialClinicoCampo[]>([]);

  const editButtonRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wasEditingRef = useRef(false);

  // La marca de «recién cambiado» se disipa sola.
  useEffect(() => {
    if (changed.length === 0) return;
    const timer = window.setTimeout(() => setChanged([]), 2600);
    return () => window.clearTimeout(timer);
  }, [changed]);

  // Al abrir el formulario el foco va al primer campo; al cerrarlo vuelve al botón principal.
  useEffect(() => {
    if (editing) {
      wasEditingRef.current = true;
      stageRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true });
      return;
    }
    if (!wasEditingRef.current) return;
    wasEditingRef.current = false;
    editButtonRef.current?.focus({ preventScroll: true });
  }, [editing]);

  if (!puedeAcceder) {
    return (
      <EmptyState
        illustration="error"
        title="Sin acceso al historial clínico"
        description="El historial clínico psicológico solo está disponible para Psicología, Titular y Subdirección."
      />
    );
  }

  const historial = historialQuery.data ?? null;

  function startEditing() {
    setDraft(draftFromHistorial(historial));
    setDirection('forward');
    setEditing(true);
  }

  function stopEditing() {
    setDirection('back');
    setEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardar.isPending || savedFlash) return;

    const tieneAlgunDato =
      Boolean(draft.motivoConsulta.trim()) ||
      Boolean(draft.antecedentesPersonales.trim()) ||
      Boolean(draft.antecedentesFamiliares.trim()) ||
      Boolean(draft.observacionesIniciales.trim()) ||
      draft.tieneAtencionPsicologicaPrevia;

    if (!tieneAlgunDato) {
      toast('Captura al menos un campo del historial clínico antes de guardar.', { tone: 'error' });
      return;
    }

    if (historial && camposCambiados(historial, draft).length === 0) {
      toast('No hay cambios por guardar.');
      stopEditing();
      return;
    }

    try {
      const guardado = await guardar.mutateAsync({
        fichaId,
        actualizadoEn: historial?.actualizadoEn ?? null,
        motivoConsulta: draft.motivoConsulta,
        antecedentesPersonales: draft.antecedentesPersonales,
        antecedentesFamiliares: draft.antecedentesFamiliares,
        tieneAtencionPsicologicaPrevia: draft.tieneAtencionPsicologicaPrevia,
        observacionesIniciales: draft.observacionesIniciales,
      });

      setSavedFlash(true);
      if (!prefersReducedMotion()) await wait(SAVED_BUTTON_MS);
      setChanged(camposCambiados(historial, guardado));
      setSavedTick((tick) => tick + 1);
      setSavedFlash(false);
      stopEditing();
      toast('Historial clínico guardado.', { tone: 'success' });
    } catch (err) {
      handleExpedienteMutationError(
        err,
        queryClient,
        fichaId,
        'No se pudo guardar el historial clínico.',
      );
    }
  }

  const busy = guardar.isPending || savedFlash;
  const isChanged = (campo: HistorialClinicoCampo) => changed.includes(campo);

  return (
    <section aria-label="Historial clínico" className="vc-hc">
      <header className="vc-hc__head">
        <div className="vc-hc__head-text">
          <div className="vc-hc__title-wrap">
            <h4 className="vc-hc__title">Historial clínico</h4>
            <span role="status" className="vc-hc__status">
              {savedTick > 0 ? (
                <span key={savedTick} className="vc-hc__saved">
                  <span className="vc-hc__saved-badge" aria-hidden>
                    <Icon name="check" className="vc-hc__saved-icon" />
                  </span>
                  <span>Guardado</span>
                </span>
              ) : null}
            </span>
          </div>
          <p className="vc-hc__subtitle">
            Motivo de consulta, antecedentes y observaciones iniciales de Psicología.
          </p>
          {!puedeEscribirHistorialClinico(user?.role) ? (
            <p className="vc-hc__note">Solo Psicología puede registrar o editar el historial clínico.</p>
          ) : null}
        </div>

        {canEdit && !historialQuery.isLoading && !historialQuery.isError ? (
          <button
            ref={editButtonRef}
            type="button"
            className="mk-button mk-button--tonal mk-button--sm vc-hc__action"
            aria-hidden={editing ? true : undefined}
            tabIndex={editing ? -1 : undefined}
            disabled={editing}
            onClick={startEditing}
          >
            {historial ? 'Editar' : 'Registrar historial clínico'}
          </button>
        ) : null}
      </header>

      {historialQuery.isError ? (
        <EmptyState
          illustration="error"
          title="No se pudo cargar el historial clínico"
          actions={RETRY_ACTION}
          onAction={() => void historialQuery.refetch()}
        />
      ) : (
        <Skeleton loading={historialQuery.isLoading} shape="card" lines={4} label="Cargando historial clínico">
          <div ref={stageRef} key={editing ? 'edit' : 'view'} className="vc-hc-stage" data-direction={direction}>
            {editing ? (
              <form onSubmit={(e) => void handleSubmit(e)} className="vc-hc-form" aria-label="Editar historial clínico">
                <TextAreaField
                  label="Motivo de consulta"
                  placeholder="Describe el motivo principal de atención"
                  value={draft.motivoConsulta}
                  disabled={busy}
                  index={0}
                  onChange={(motivoConsulta) => setDraft({ ...draft, motivoConsulta })}
                />

                <div className="vc-hc-form__pair">
                  <TextAreaField
                    label="Antecedentes personales"
                    placeholder="Antecedentes psicológicos, médicos o relevantes"
                    value={draft.antecedentesPersonales}
                    disabled={busy}
                    index={1}
                    onChange={(antecedentesPersonales) => setDraft({ ...draft, antecedentesPersonales })}
                  />
                  <TextAreaField
                    label="Antecedentes familiares"
                    placeholder="Contexto e historial familiar"
                    value={draft.antecedentesFamiliares}
                    disabled={busy}
                    index={2}
                    onChange={(antecedentesFamiliares) => setDraft({ ...draft, antecedentesFamiliares })}
                  />
                </div>

                <div className="vc-hc-switch" style={{ '--i': 3 } as CSSProperties}>
                  <GlassSwitch
                    checked={draft.tieneAtencionPsicologicaPrevia}
                    disabled={busy}
                    onChange={(checked) => setDraft({ ...draft, tieneAtencionPsicologicaPrevia: checked })}
                  >
                    Ha recibido atención psicológica previa
                  </GlassSwitch>
                </div>

                <TextAreaField
                  label="Observaciones iniciales"
                  placeholder="Notas clínicas de valoración inicial"
                  value={draft.observacionesIniciales}
                  disabled={busy}
                  index={4}
                  onChange={(observacionesIniciales) => setDraft({ ...draft, observacionesIniciales })}
                />

                <div className="vc-hc-form__footer" style={{ '--i': 5 } as CSSProperties}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={stopEditing}
                    className="mk-button mk-button--text"
                  >
                    Cancelar
                  </button>
                  <LoadingButton
                    type="submit"
                    state={guardar.isPending ? 'loading' : savedFlash ? 'success' : 'idle'}
                    labels={LOADING_LABELS}
                    disabled={busy}
                    className="mk-button mk-button--filled"
                  >
                    Guardar historial
                  </LoadingButton>
                </div>
              </form>
            ) : historial ? (
              <div className="vc-hc-grid">
                <ReadField
                  label="Motivo de consulta"
                  value={valorCampoHistorial(historial, 'motivoConsulta')}
                  index={0}
                  changed={isChanged('motivoConsulta')}
                  wide
                  featured
                />
                <ReadField
                  label="Antecedentes personales"
                  value={valorCampoHistorial(historial, 'antecedentesPersonales')}
                  index={1}
                  changed={isChanged('antecedentesPersonales')}
                />
                <ReadField
                  label="Antecedentes familiares"
                  value={valorCampoHistorial(historial, 'antecedentesFamiliares')}
                  index={2}
                  changed={isChanged('antecedentesFamiliares')}
                />
                <ReadField
                  label="Atención psicológica previa"
                  value={valorCampoHistorial(historial, 'tieneAtencionPsicologicaPrevia')}
                  index={3}
                  changed={isChanged('tieneAtencionPsicologicaPrevia')}
                  wide
                />
                <ReadField
                  label="Observaciones iniciales"
                  value={valorCampoHistorial(historial, 'observacionesIniciales')}
                  index={4}
                  changed={isChanged('observacionesIniciales')}
                  wide
                />
              </div>
            ) : (
              <EmptyState
                illustration="inbox"
                title="Sin historial clínico registrado"
                description={
                  canEdit
                    ? 'Captura el motivo de consulta, antecedentes y valoración inicial de la usuaria.'
                    : 'Aún no se ha capturado el historial clínico de este expediente.'
                }
              />
            )}
          </div>
        </Skeleton>
      )}

      {historial && !historialQuery.isError ? <HistorialClinicoVersiones fichaId={fichaId} /> : null}
    </section>
  );
});
