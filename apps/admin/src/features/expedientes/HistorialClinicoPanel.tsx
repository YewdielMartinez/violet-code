import { memo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, GlassSwitch, LoadingButton, Skeleton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/glass-switch';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { puedeAccederHistorialClinico } from '@/domain/models/FichaRegistro';
import type { HistorialClinico } from '@/domain/models/HistorialClinico';
import type { EstadoFicha } from '@/domain/models/Persona';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import {
  handleExpedienteMutationError,
  useGuardarHistorialClinico,
  useHistorialClinico,
} from './api';

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

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];
const LOADING_LABELS = { loading: 'Guardando…', success: 'Guardado', error: 'No se guardó' };

function ReadField({ label, value }: { label: string; value: string | null | undefined }) {
  const clean = value?.trim() || null;
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5">
      <p className="text-sm font-medium text-on-surface-variant">{label}</p>
      {clean ? (
        <p className="mt-1 whitespace-pre-wrap text-base text-on-surface">{clean}</p>
      ) : (
        <p className="mt-1 text-base text-on-surface-variant">Sin registrar</p>
      )}
    </div>
  );
}

/** Historial clínico psicológico del expediente (`RF-11`, `RF-12`, solo Titular, Subdirección y Psicología). */
export const HistorialClinicoPanel = memo(function HistorialClinicoPanel({
  fichaId,
  estado,
}: HistorialClinicoPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const puedeAcceder = puedeAccederHistorialClinico(user?.role);
  const canEdit = puedeAcceder && estado !== 'archivado';

  const historialQuery = useHistorialClinico(fichaId, puedeAcceder);
  const guardar = useGuardarHistorialClinico(fichaId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<HistorialDraft>(() => draftFromHistorial(null));

  if (!puedeAcceder) {
    return (
      <EmptyState
        illustration="error"
        title="Sin acceso al historial clínico"
        description="El historial clínico psicológico solo está disponible para Psicología, Titular y Subdirección."
      />
    );
  }

  function startEditing() {
    setDraft(draftFromHistorial(historialQuery.data));
    setEditing(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

    try {
      await guardar.mutateAsync({
        fichaId,
        actualizadoEn: historialQuery.data?.actualizadoEn ?? null,
        motivoConsulta: draft.motivoConsulta,
        antecedentesPersonales: draft.antecedentesPersonales,
        antecedentesFamiliares: draft.antecedentesFamiliares,
        tieneAtencionPsicologicaPrevia: draft.tieneAtencionPsicologicaPrevia,
        observacionesIniciales: draft.observacionesIniciales,
      });
      setEditing(false);
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

  const historial = historialQuery.data ?? null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-base font-semibold text-on-surface">Historial clínico</h4>
          <p className="text-sm text-on-surface-variant">
            Motivo de consulta, antecedentes y observaciones iniciales de Psicología.
          </p>
        </div>

        {canEdit && !editing && !historialQuery.isLoading && !historialQuery.isError ? (
          <button
            type="button"
            className="mk-button mk-button--tonal mk-button--sm"
            onClick={startEditing}
          >
            <Icon name={historial ? 'edit' : 'add'} />
            <span>{historial ? 'Editar' : 'Registrar historial clínico'}</span>
          </button>
        ) : null}
      </div>

      {historialQuery.isError ? (
        <EmptyState
          illustration="error"
          title="No se pudo cargar el historial clínico"
          actions={RETRY_ACTION}
          onAction={() => void historialQuery.refetch()}
        />
      ) : (
        <Skeleton loading={historialQuery.isLoading} shape="card" lines={4} label="Cargando historial clínico">
          {editing ? (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"
            >
              <label className="mk-field">
                <span className="mk-field__label">Motivo de consulta</span>
                <textarea
                  rows={3}
                  maxLength={5000}
                  disabled={guardar.isPending}
                  value={draft.motivoConsulta}
                  onChange={(e) => setDraft({ ...draft, motivoConsulta: e.target.value })}
                  placeholder="Describe el motivo principal de atención"
                  className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </label>

              <label className="mk-field">
                <span className="mk-field__label">Antecedentes personales</span>
                <textarea
                  rows={3}
                  maxLength={5000}
                  disabled={guardar.isPending}
                  value={draft.antecedentesPersonales}
                  onChange={(e) => setDraft({ ...draft, antecedentesPersonales: e.target.value })}
                  placeholder="Antecedentes psicológicos, médicos o relevantes"
                  className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </label>

              <label className="mk-field">
                <span className="mk-field__label">Antecedentes familiares</span>
                <textarea
                  rows={3}
                  maxLength={5000}
                  disabled={guardar.isPending}
                  value={draft.antecedentesFamiliares}
                  onChange={(e) => setDraft({ ...draft, antecedentesFamiliares: e.target.value })}
                  placeholder="Contexto e historial familiar"
                  className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </label>

              <div className="rounded-2xl bg-surface-container-low p-4">
                <GlassSwitch
                  checked={draft.tieneAtencionPsicologicaPrevia}
                  onChange={(checked) =>
                    setDraft({ ...draft, tieneAtencionPsicologicaPrevia: checked })
                  }
                >
                  Ha recibido atención psicológica previa
                </GlassSwitch>
              </div>

              <label className="mk-field">
                <span className="mk-field__label">Observaciones iniciales</span>
                <textarea
                  rows={3}
                  maxLength={5000}
                  disabled={guardar.isPending}
                  value={draft.observacionesIniciales}
                  onChange={(e) => setDraft({ ...draft, observacionesIniciales: e.target.value })}
                  placeholder="Notas clínicas de valoración inicial"
                  className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={guardar.isPending}
                  onClick={() => setEditing(false)}
                  className="mk-button mk-button--text"
                >
                  Cancelar
                </button>
                <LoadingButton
                  type="submit"
                  state={guardar.isPending ? 'loading' : 'idle'}
                  labels={LOADING_LABELS}
                  disabled={guardar.isPending}
                  className="mk-button mk-button--filled"
                >
                  Guardar historial
                </LoadingButton>
              </div>
            </form>
          ) : historial ? (
            <div className="grid gap-3">
              <ReadField label="Motivo de consulta" value={historial.motivoConsulta} />
              <ReadField label="Antecedentes personales" value={historial.antecedentesPersonales} />
              <ReadField label="Antecedentes familiares" value={historial.antecedentesFamiliares} />
              <ReadField
                label="Atención psicológica previa"
                value={
                  historial.tieneAtencionPsicologicaPrevia === null
                    ? null
                    : historial.tieneAtencionPsicologicaPrevia
                      ? 'Sí'
                      : 'No'
                }
              />
              <ReadField label="Observaciones iniciales" value={historial.observacionesIniciales} />
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
        </Skeleton>
      )}
    </div>
  );
});
