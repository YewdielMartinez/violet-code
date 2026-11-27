import { memo } from 'react';
import { toast } from '@yewdiel21/motion-kit/react';
import { ESTADO_FICHA_LABELS, type ExpedienteResumen } from '@/domain/models/Persona';
import { Icon } from '@/shared/ui/Icon';
import {
  ESTADO_BADGE_STYLES,
  copyTextToClipboard,
  formatPhoneDisplay,
} from './formatters';

interface Props {
  expediente: ExpedienteResumen;
}

/** Estado operativo del expediente y tarjetas de contacto directo de la usuaria. */
export const ExpedienteContactoSection = memo(function ExpedienteContactoSection({
  expediente,
}: Props) {
  const statusStyle = ESTADO_BADGE_STYLES[expediente.estado];
  const rawPhone = expediente.persona.celular?.trim() ?? '';
  const formattedPhone = formatPhoneDisplay(expediente.persona.celular);

  async function handleCopy(value: string, successMessage: string, errorMessage: string) {
    const ok = await copyTextToClipboard(value);
    if (ok) {
      toast(successMessage, { tone: 'success' });
    } else {
      toast(errorMessage, { tone: 'error' });
    }
  }

  return (
    <div className="grid gap-6">
      <section aria-label="Estado del expediente" className="grid gap-2">
        <p className="text-base font-semibold text-on-surface">Estado del expediente</p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-base font-medium ${statusStyle.pill}`}
          >
            <span aria-hidden className={`size-2 rounded-full ${statusStyle.dot}`} />
            <span>{ESTADO_FICHA_LABELS[expediente.estado]}</span>
          </span>

          {expediente.enListaUrgencias ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-danger-bg px-4 py-1.5 text-base font-medium text-status-danger">
              <span aria-hidden className="size-2 rounded-full bg-status-danger" />
              <span>Prioritario</span>
            </span>
          ) : null}

          <span className="text-sm text-on-surface-variant">
            Consulta auditada en bitácora (RF-22)
          </span>
        </div>
      </section>

      <section aria-label="Contacto" className="grid gap-2.5">
        <h4 className="text-base font-semibold text-on-surface">Contacto</h4>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-on-surface-variant">CURP</p>
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
                <a
                  href={`tel:${rawPhone}`}
                  aria-label={`Llamar al ${rawPhone}`}
                  className="grid size-11 place-items-center rounded-xl border border-outline-variant bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                >
                  <Icon name="call" className="text-[20px]" />
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
});
