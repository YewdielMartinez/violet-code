import { memo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingButton, Select, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/select';
import {
  ESCOLARIDAD_LABELS,
  puedeEditarExpediente,
  type EscolaridadNivel,
  type FichaCompletaDetalle,
} from '@/domain/models/FichaRegistro';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { handleExpedienteMutationError, useActualizarPersona, useFichaDetail } from '../api';
import { ExpedienteEstadoCard } from './ExpedienteEstado';
import { copyTextToClipboard, formatPhoneDisplay } from './formatters';

interface Props {
  expediente: ExpedienteResumen;
}

const ESCOLARIDAD_OPTIONS = Object.entries(ESCOLARIDAD_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const CELULAR_REGEX = /^[0-9]{10}$/;
const SAVE_LABELS = { loading: 'Guardando…', success: 'Guardado', error: 'Error al guardar' };

interface PersonaDraft {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  celular: string;
  escolaridad: EscolaridadNivel | '';
  discapacidad: string;
  grupoEtnico: string;
  religion: string;
}

function buildPersonaDraft(
  expediente: ExpedienteResumen,
  detail: FichaCompletaDetalle | null | undefined,
): PersonaDraft {
  return {
    nombres: detail?.persona.nombres ?? expediente.persona.nombres,
    apellidoPaterno: detail?.persona.apellidoPaterno ?? expediente.persona.apellidoPaterno,
    apellidoMaterno: detail?.persona.apellidoMaterno ?? expediente.persona.apellidoMaterno ?? '',
    celular: detail?.persona.celular ?? expediente.persona.celular ?? '',
    escolaridad: detail?.persona.escolaridad ?? '',
    discapacidad: detail?.persona.discapacidad ?? '',
    grupoEtnico: detail?.persona.grupoEtnico ?? '',
    religion: detail?.persona.religion ?? '',
  };
}

/** Estado operativo del expediente y tarjetas de datos generales/contacto de la usuaria. */
export const ExpedienteContactoSection = memo(function ExpedienteContactoSection({
  expediente,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: detail } = useFichaDetail(expediente.id);
  const actualizarPersona = useActualizarPersona(expediente.id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PersonaDraft>(() => buildPersonaDraft(expediente, detail));

  const canEdit =
    expediente.estado !== 'archivado' && puedeEditarExpediente(user?.role) && Boolean(detail);

  const currentCelular = detail?.persona.celular ?? expediente.persona.celular;
  const rawPhone = currentCelular?.trim() ?? '';
  const formattedPhone = formatPhoneDisplay(currentCelular);

  async function handleCopy(value: string, successMessage: string, errorMessage: string) {
    const ok = await copyTextToClipboard(value);
    if (ok) {
      toast(successMessage, { tone: 'success' });
    } else {
      toast(errorMessage, { tone: 'error' });
    }
  }

  function startEditing() {
    setDraft(buildPersonaDraft(expediente, detail));
    setEditing(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    if (!draft.nombres.trim() || !draft.apellidoPaterno.trim()) {
      toast('Nombre(s) y apellido paterno son obligatorios.', { tone: 'error' });
      return;
    }
    const cleanPhone = draft.celular.trim();
    if (cleanPhone && !CELULAR_REGEX.test(cleanPhone)) {
      toast('El teléfono celular debe tener exactamente 10 dígitos.', { tone: 'error' });
      return;
    }

    try {
      await actualizarPersona.mutateAsync({
        personaId: detail.persona.id,
        actualizadoEn: detail.persona.actualizadoEn ?? '',
        nombres: draft.nombres,
        apellidoPaterno: draft.apellidoPaterno,
        apellidoMaterno: draft.apellidoMaterno,
        celular: cleanPhone,
        escolaridad: draft.escolaridad || null,
        discapacidad: draft.discapacidad,
        grupoEtnico: draft.grupoEtnico,
        religion: draft.religion,
      });
      setEditing(false);
      toast('Datos generales actualizados.', { tone: 'success' });
    } catch (err) {
      handleExpedienteMutationError(
        err,
        queryClient,
        expediente.id,
        'No se pudieron actualizar los datos generales.',
      );
    }
  }

  return (
    <div className="grid gap-6">
      <ExpedienteEstadoCard expediente={expediente} />

      <section aria-label="Contacto" className="grid gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-base font-semibold text-on-surface">Contacto y datos generales</h4>
          {canEdit && !editing ? (
            <button
              type="button"
              className="mk-button mk-button--tonal mk-button--sm"
              onClick={startEditing}
            >
              <Icon name="edit" />
              <span>Editar</span>
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-on-surface-variant">CURP (solo lectura)</p>
              <p className="mt-1 break-all font-mono text-base font-semibold text-on-surface sm:text-lg">
                {expediente.persona.curp}
              </p>
            </div>
            <button
              type="button"
              aria-label="Copiar CURP"
              onClick={() =>
                void handleCopy(
                  expediente.persona.curp,
                  'CURP copiada al portapapeles.',
                  'No se pudo copiar la CURP.',
                )
              }
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-outline-variant bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <Icon name="content_copy" className="text-[20px]" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-on-surface-variant">Teléfono celular</p>
              {formattedPhone ? (
                <p className="mt-1 font-mono text-base font-semibold text-on-surface sm:text-lg">
                  {formattedPhone}
                </p>
              ) : (
                <p className="mt-1 text-base text-on-surface-variant">Sin registrar</p>
              )}
            </div>

            {rawPhone ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Copiar teléfono"
                  onClick={() =>
                    void handleCopy(
                      rawPhone,
                      'Teléfono copiado al portapapeles.',
                      'No se pudo copiar el teléfono.',
                    )
                  }
                  className="grid size-11 place-items-center rounded-xl border border-outline-variant bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                >
                  <Icon name="content_copy" className="text-[20px]" />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {editing ? (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="vc-ficha-form grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="mk-field sm:col-span-2">
                <span className="mk-field__label">Nombre(s) *</span>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={draft.nombres}
                  onChange={(e) => setDraft({ ...draft, nombres: e.target.value })}
                />
              </label>

              <label className="mk-field">
                <span className="mk-field__label">Apellido paterno *</span>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={draft.apellidoPaterno}
                  onChange={(e) => setDraft({ ...draft, apellidoPaterno: e.target.value })}
                />
              </label>

              <label className="mk-field">
                <span className="mk-field__label">Apellido materno</span>
                <input
                  type="text"
                  maxLength={100}
                  value={draft.apellidoMaterno}
                  onChange={(e) => setDraft({ ...draft, apellidoMaterno: e.target.value })}
                />
              </label>

              <label className="mk-field">
                <span className="mk-field__label">Teléfono celular (10 dígitos)</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="6680000000"
                  value={draft.celular}
                  onChange={(e) =>
                    setDraft({ ...draft, celular: e.target.value.replace(/\D/g, '').slice(0, 10) })
                  }
                />
              </label>

              <div className="grid gap-2">
                <span className="vc-ficha-label">Escolaridad</span>
                <Select
                  size="lg"
                  label="Escolaridad"
                  placeholder="Selecciona…"
                  options={ESCOLARIDAD_OPTIONS}
                  value={draft.escolaridad}
                  onChange={(v) => setDraft({ ...draft, escolaridad: v as EscolaridadNivel })}
                />
              </div>

              <label className="mk-field">
                <span className="mk-field__label">Discapacidad</span>
                <input
                  type="text"
                  maxLength={120}
                  value={draft.discapacidad}
                  onChange={(e) => setDraft({ ...draft, discapacidad: e.target.value })}
                  placeholder="Ninguna o especificar"
                />
              </label>

              <label className="mk-field">
                <span className="mk-field__label">Grupo étnico</span>
                <input
                  type="text"
                  maxLength={120}
                  value={draft.grupoEtnico}
                  onChange={(e) => setDraft({ ...draft, grupoEtnico: e.target.value })}
                />
              </label>

              <label className="mk-field sm:col-span-2">
                <span className="mk-field__label">Religión</span>
                <input
                  type="text"
                  maxLength={120}
                  value={draft.religion}
                  onChange={(e) => setDraft({ ...draft, religion: e.target.value })}
                />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={actualizarPersona.isPending}
                onClick={() => setEditing(false)}
                className="mk-button mk-button--text"
              >
                Cancelar
              </button>
              <LoadingButton
                type="submit"
                state={actualizarPersona.isPending ? 'loading' : 'idle'}
                labels={SAVE_LABELS}
                disabled={actualizarPersona.isPending}
                className="mk-button mk-button--filled"
              >
                Guardar datos
              </LoadingButton>
            </div>
          </form>
        ) : detail ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5">
              <p className="text-sm font-medium text-on-surface-variant">Escolaridad</p>
              <p className="mt-1 text-base text-on-surface">
                {detail.persona.escolaridad
                  ? ESCOLARIDAD_LABELS[detail.persona.escolaridad]
                  : 'Sin registrar'}
              </p>
            </div>
            <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5">
              <p className="text-sm font-medium text-on-surface-variant">Discapacidad</p>
              <p className="mt-1 text-base text-on-surface">
                {detail.persona.discapacidad?.trim() || 'Sin registrar'}
              </p>
            </div>
            <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5">
              <p className="text-sm font-medium text-on-surface-variant">Grupo étnico</p>
              <p className="mt-1 text-base text-on-surface">
                {detail.persona.grupoEtnico?.trim() || 'Sin registrar'}
              </p>
            </div>
            <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5">
              <p className="text-sm font-medium text-on-surface-variant">Religión</p>
              <p className="mt-1 text-base text-on-surface">
                {detail.persona.religion?.trim() || 'Sin registrar'}
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
});
