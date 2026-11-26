import { useId, useState, type FormEvent } from 'react';
import { Dialog, LoadingButton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/loading-button';
import { Icon } from '@/shared/ui/Icon';
import {
  ESTADO_FICHA_LABELS,
  isValidCurp,
  normalizeCurp,
  useVerifyCurp,
  type ExpedienteResumen,
  type PreRegistroMovil,
  type VerificacionCurpResult,
} from './api';
import { BannerPrecargaMovil } from './BannerPrecargaMovil';
import type { FichaSeedContext } from './ficha/useFichaForm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowPreRegistroLookup: boolean;
  onOpenExpediente: (expediente: ExpedienteResumen) => void;
  onPreloadConfirmed: (preRegistro: PreRegistroMovil | null) => void;
  onStartFicha: (seed: FichaSeedContext) => void;
}

/**
 * Flujo modal para verificar CURP antes de iniciar una Ficha Única (`RF-04`, `RF-34`, `RN-02`):
 * mantiene la tabla principal de Expedientes limpia y visible al entrar.
 */
export function VerificarCurpDialog({
  open,
  onOpenChange,
  allowPreRegistroLookup,
  onOpenExpediente,
  onPreloadConfirmed,
  onStartFicha,
}: Props) {
  const inputId = useId();
  const hintId = useId();

  const [curpInput, setCurpInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificacionCurpResult | null>(null);
  const [confirmedPreloadId, setConfirmedPreloadId] = useState<string | null>(null);

  const verifyMutation = useVerifyCurp();
  const normalized = normalizeCurp(curpInput);
  const curpComplete = normalized.length === 18;
  const curpValid = curpComplete && isValidCurp(normalized);

  function resetVerification() {
    setResult(null);
    setConfirmedPreloadId(null);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setValidationError(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!curpValid) {
      setValidationError('Captura una CURP válida de 18 caracteres.');
      return;
    }

    setValidationError(null);
    setConfirmedPreloadId(null);

    try {
      const outcome = await verifyMutation.mutateAsync({
        curp: normalized,
        allowPreRegistroLookup,
      });
      setResult(outcome);
    } catch {
      toast('No se pudo verificar la CURP en Supabase.', { tone: 'error' });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Content size="xl">
        <Dialog.Header>
          <Dialog.Title>Nuevo expediente · Verificar CURP</Dialog.Title>
          <Dialog.Close label="Cerrar" />
        </Dialog.Header>

        <Dialog.Body>
          <p className="mb-4 text-sm text-on-surface-variant">
            Verifica si la usuaria ya cuenta con expediente para evitar duplicados o si tiene un
            pre-registro previo en la app móvil.
          </p>

          <form onSubmit={handleSubmit} className="grid gap-3" noValidate>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={inputId} className="text-sm font-medium text-on-surface">
                CURP de la usuaria
              </label>
              {normalized.length > 0 ? (
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-medium ${
                    curpValid
                      ? 'bg-status-success-bg text-status-success'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {normalized.length}/18 {curpValid ? '· Formato válido' : ''}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="mk-field min-w-[24ch] flex-1">
                <input
                  id={inputId}
                  type="text"
                  maxLength={18}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  placeholder="Ej. GALA900512MSLNRR01"
                  value={curpInput}
                  onChange={(e) => {
                    setCurpInput(normalizeCurp(e.target.value));
                    setValidationError(null);
                    if (result) resetVerification();
                  }}
                  aria-invalid={validationError ? true : undefined}
                  aria-describedby={validationError ? hintId : undefined}
                  className="font-mono tracking-wider uppercase"
                />
              </label>

              <LoadingButton
                type="submit"
                state={verifyMutation.isPending ? 'loading' : 'idle'}
                className="mk-button mk-button--primary"
                disabled={!curpComplete}
              >
                <Icon name="person_search" />
                <span>Verificar</span>
              </LoadingButton>
            </div>
          </form>

          {validationError ? (
            <p id={hintId} role="alert" className="mt-2 text-sm text-status-danger">
              {validationError}
            </p>
          ) : null}

          {result?.kind === 'expediente_existente' ? (
            <div
              role="alert"
              className="mt-5 rounded-2xl border border-status-warning/40 bg-status-warning-bg/35 p-4"
            >
              <div className="flex items-start gap-3">
                <Icon name="warning" className="mt-0.5 text-status-warning" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-on-surface">Esta persona ya está registrada</p>
                  <p className="mt-0.5 text-sm text-on-surface-variant">
                    Para evitar duplicados, abre su expediente existente en lugar de crear uno nuevo.
                  </p>
                </div>
              </div>

              <dl className="mt-3 grid gap-3 rounded-xl bg-surface-container-lowest/90 p-3.5 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-on-surface-variant">Folio</dt>
                  <dd className="font-mono font-medium text-on-surface">{result.expediente.folio}</dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">CURP</dt>
                  <dd className="break-all font-mono font-medium text-on-surface">
                    {result.expediente.persona.curp}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Estado</dt>
                  <dd className="font-medium text-on-surface">
                    {ESTADO_FICHA_LABELS[result.expediente.estado]}
                  </dd>
                </div>
                <div className="sm:col-span-3">
                  <dt className="text-xs text-on-surface-variant">Nombre completo</dt>
                  <dd className="font-medium text-on-surface">
                    {result.expediente.persona.nombreCompleto}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="mk-button mk-button--primary"
                  onClick={() => {
                    const existing = result.expediente;
                    onOpenChange(false);
                    onOpenExpediente(existing);
                  }}
                >
                  Abrir expediente existente
                </button>
              </div>
            </div>
          ) : null}

          {result?.kind === 'persona_sin_ficha' ? (
            <div
              role="status"
              className="mt-5 grid gap-3 rounded-2xl border border-status-info/40 bg-status-info-bg/40 p-4 text-sm text-on-surface"
            >
              <p>
                La CURP{' '}
                <strong className="break-all font-mono tracking-wide">{result.persona.curp}</strong>{' '}
                ya pertenece a <strong>{result.persona.nombreCompleto}</strong> en el padrón (sin
                Ficha Única activa).
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="mk-button mk-button--primary"
                  onClick={() => {
                    const p = result.persona;
                    onOpenChange(false);
                    onStartFicha({ curp: p.curp, existingPersonaId: p.id });
                  }}
                >
                  Continuar a Ficha Única
                </button>
              </div>
            </div>
          ) : null}

          {result?.kind === 'pre_registro_movil' ? (
            <BannerPrecargaMovil
              preRegistro={result.preRegistro}
              confirmed={confirmedPreloadId === result.preRegistro.preRegistroId}
              onConfirm={(pre) => {
                setConfirmedPreloadId(pre.preRegistroId);
                onPreloadConfirmed(pre);
                onOpenChange(false);
                onStartFicha({
                  curp: pre.curp,
                  existingPersonaId: pre.personaId,
                  preRegistro: pre,
                });
              }}
              onDismiss={() => {
                resetVerification();
                onPreloadConfirmed(null);
              }}
            />
          ) : null}

          {result?.kind === 'nuevo' ? (
            <div
              role="status"
              className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-status-success/40 bg-status-success-bg/40 p-4 text-sm text-on-surface"
            >
              <div className="flex items-center gap-3">
                <Icon name="verified_user" className="text-status-success" />
                <span>
                  CURP <strong className="break-all font-mono tracking-wide">{result.curp}</strong>{' '}
                  disponible sin duplicados ni pre-registro previo.
                </span>
              </div>
              <button
                type="button"
                className="mk-button mk-button--primary"
                onClick={() => {
                  const curp = result.curp;
                  onOpenChange(false);
                  onStartFicha({ curp });
                }}
              >
                Continuar a Ficha Única
              </button>
            </div>
          ) : null}
        </Dialog.Body>

        <Dialog.Footer>
          <button type="button" className="mk-button mk-button--text" onClick={() => handleClose(false)}>
            Cerrar
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
