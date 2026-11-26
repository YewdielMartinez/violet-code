import { toast } from '@yewdiel21/motion-kit/react';
import { Icon } from '@/shared/ui/Icon';
import type { PreRegistroMovil } from './api';

interface Props {
  preRegistro: PreRegistroMovil;
  confirmed: boolean;
  onConfirm: (preRegistro: PreRegistroMovil) => void;
  onDismiss: () => void;
}

/**
 * Banner de precarga desde la app móvil (`RF-34`).
 * Muestra los datos provenientes de `buscar_pre_registro_por_curp()` antes de capturar
 * la Ficha Única para confirmar y ligar el expediente sin duplicar a la usuaria.
 */
export function BannerPrecargaMovil({ preRegistro, confirmed, onConfirm, onDismiss }: Props) {
  function handleConfirm() {
    onConfirm(preRegistro);
    toast('Datos del pre-registro móvil listos para la Ficha Única.');
  }

  return (
    <section
      aria-live="polite"
      className={`mt-4 rounded-3xl border p-5 transition-colors ${
        confirmed
          ? 'border-status-success/40 bg-status-success-bg/40'
          : 'border-status-info/40 bg-status-info-bg/40'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={`grid size-10 shrink-0 place-items-center rounded-full ${
              confirmed
                ? 'bg-status-success-bg text-status-success'
                : 'bg-status-info-bg text-status-info'
            }`}
          >
            <Icon name={confirmed ? 'check_circle' : 'smartphone'} />
          </span>
          <div>
            <p className="text-sm font-medium text-on-surface">
              {confirmed
                ? 'Precarga móvil confirmada'
                : 'Usuaria con pre-registro en la app móvil'}
            </p>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              {confirmed
                ? 'Los datos generales quedaron confirmados para iniciar la Ficha Única sin duplicar el registro.'
                : 'Se encontró un registro activo en móvil para esta CURP. Revisa y confirma para precargar sus datos.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!confirmed ? (
            <button type="button" className="mk-button mk-button--filled" onClick={handleConfirm}>
              <Icon name="download_done" />
              <span className="ml-2">Confirmar precarga</span>
            </button>
          ) : null}
          <button type="button" className="mk-button mk-button--text" onClick={onDismiss}>
            Limpiar
          </button>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 rounded-2xl bg-surface-container-lowest/85 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium text-on-surface-variant">Nombre completo</dt>
          <dd className="mt-0.5 text-sm font-medium text-on-surface">{preRegistro.nombreCompleto}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-on-surface-variant">CURP</dt>
          <dd className="mt-0.5 font-mono text-sm text-on-surface">{preRegistro.curp}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-on-surface-variant">Nacimiento / Sexo</dt>
          <dd className="mt-0.5 text-sm text-on-surface">
            {preRegistro.fechaNacimiento} · {preRegistro.entidadNacimiento} · {preRegistro.sexo}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-on-surface-variant">Teléfono celular</dt>
          <dd className="mt-0.5 font-mono text-sm text-on-surface">
            {preRegistro.celular ?? 'No proporcionado'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
