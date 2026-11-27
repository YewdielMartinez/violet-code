import { memo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Select, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
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
import { handleExpedienteMutationError, useActualizarPersona, useFichaDetail } from '../api';
import {
  DataSection,
  Dato,
  DatoGrid,
  FormInlineError,
  SectionFormFooter,
  describeMutationError,
} from '../datos/DataSection';
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
  const [savedTick, setSavedTick] = useState(0);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
    setSaved(false);
    setFormError(null);
    setEditing(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    if (!draft.nombres.trim() || !draft.apellidoPaterno.trim()) {
      const message = 'Nombre(s) y apellido paterno son obligatorios.';
      setFormError(message);
      toast(message, { tone: 'error' });
      return;
    }
    const cleanPhone = draft.celular.trim();
    if (cleanPhone && !CELULAR_REGEX.test(cleanPhone)) {
      const message = 'El teléfono celular debe tener exactamente 10 dígitos.';
      setFormError(message);
      toast(message, { tone: 'error' });
      return;
    }

    setFormError(null);
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
      setSaved(true);
      setEditing(false);
      setSavedTick((tick) => tick + 1);
      toast('Datos generales actualizados.', { tone: 'success' });
    } catch (err) {
      setFormError(describeMutationError(err, 'No se pudieron actualizar los datos generales.'));
      handleExpedienteMutationError(
        err,
        queryClient,
        expediente.id,
        'No se pudieron actualizar los datos generales.',
      );
    }
  }

  const editForm = (
    <form onSubmit={(e) => void handleSubmit(e)} className="vc-ficha-form vc-sec-form">
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

      <FormInlineError message={formError} />

      <SectionFormFooter
        pending={actualizarPersona.isPending}
        saved={saved}
        onCancel={() => setEditing(false)}
        submitLabel="Guardar datos"
      />
    </form>
  );

  return (
    <div className="grid gap-6">
      <ExpedienteEstadoCard expediente={expediente} />

      <DataSection
        title="Contacto y datos generales"
        editLabel="contacto y datos generales"
        canEdit={canEdit}
        editing={editing}
        onStartEdit={startEditing}
        savedTick={savedTick}
        editForm={editForm}
      >
        <DatoGrid>
          <Dato
            label="CURP (solo lectura)"
            value={expediente.persona.curp}
            mono
            action={
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
                className="mk-button mk-button--tonal mk-button--sm"
              >
                Copiar
              </button>
            }
          />

          <Dato
            label="Teléfono celular"
            value={formattedPhone}
            mono
            action={
              rawPhone ? (
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
                  className="mk-button mk-button--tonal mk-button--sm"
                >
                  Copiar
                </button>
              ) : null
            }
          />

          {detail ? (
            <>
              <Dato
                label="Escolaridad"
                value={
                  detail.persona.escolaridad ? ESCOLARIDAD_LABELS[detail.persona.escolaridad] : null
                }
              />
              <Dato label="Discapacidad" value={detail.persona.discapacidad} />
              <Dato label="Grupo étnico" value={detail.persona.grupoEtnico} />
              <Dato label="Religión" value={detail.persona.religion} />
            </>
          ) : null}
        </DatoGrid>
      </DataSection>
    </div>
  );
});
