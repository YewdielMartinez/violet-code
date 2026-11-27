import { useState, type CSSProperties } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';

interface Props {
  folio: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (motivo: string) => void;
}

const NO_ORIGIN = typeof document !== 'undefined' ? document.createElement('span') : null;
const MOTIVO_MAX = 1000;

/** Confirmación (con motivo obligatorio, como exige `reabrir_ficha`) para desarchivar desde el menú de la tabla. */
export function DesarchivarExpedienteDialog({ folio, busy, onCancel, onConfirm }: Props) {
  const [prevFolio, setPrevFolio] = useState<string | null>(folio);
  const [motivo, setMotivo] = useState('');
  const [touched, setTouched] = useState(false);

  // Al cerrarse el diálogo se limpia el formulario (ajuste de estado durante el render, sin efecto).
  if (folio !== prevFolio) {
    setPrevFolio(folio);
    if (folio === null) {
      setMotivo('');
      setTouched(false);
    }
  }

  const trimmed = motivo.trim();
  const invalid = touched && trimmed.length === 0;

  function handleConfirm() {
    setTouched(true);
    if (trimmed.length === 0) return;
    onConfirm(trimmed);
  }

  return (
    <Dialog.Root
      anchor={NO_ORIGIN}
      open={folio !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <Dialog.Content
        style={{ '--mk-dialog-width': '480px' } as CSSProperties}
        className="w-[min(480px,calc(100vw-32px))]"
      >
        <Dialog.Header
          className="flex items-center justify-start gap-2"
          style={{ justifyContent: 'flex-start' }}
        >
          <Dialog.Close label="Cerrar confirmación" />
          <Dialog.Title>¿Desarchivar expediente?</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body className="grid gap-4">
          <p className="text-base leading-relaxed text-on-surface-variant">
            El expediente {folio} volverá a estar activo. Indica el motivo de la reapertura; quedará
            registrado.
          </p>
          <label className="mk-field">
            <span className="mk-field__label">Motivo *</span>
            <textarea
              rows={3}
              maxLength={MOTIVO_MAX}
              required
              placeholder="Ej. Usuaria solicita reingreso"
              aria-invalid={invalid || undefined}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={busy}
            />
          </label>
          {invalid ? (
            <p role="alert" className="text-sm text-status-danger">
              Captura el motivo para desarchivar el expediente.
            </p>
          ) : null}
        </Dialog.Body>
        <Dialog.Footer className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="mk-button mk-button--tonal min-h-11 px-5 text-base whitespace-nowrap"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="mk-button mk-button--filled min-h-11 px-5 text-base whitespace-nowrap"
            disabled={busy}
            onClick={handleConfirm}
          >
            Sí, desarchivar
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
