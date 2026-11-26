import { toast } from '@yewdiel21/motion-kit/react';
import { Icon } from '@/shared/ui/Icon';
import type { PreRegistroMovil } from './api';

interface Props {
  preRegistro: PreRegistroMovil;
  confirmed: boolean;
  onConfirm: (preRegistro: PreRegistroMovil) => void;
  onDismiss: () => void;
}

function formatSexoLabel(sexo: PreRegistroMovil['sexo']): string {
  return sexo === 'H' ? 'Masculino' : 'Femenino';
}

/**
 * Tarjeta inline de precarga desde la app móvil (`RF-34`).
 * Muestra los datos provenientes de `buscar_pre_registro_por_curp()` dentro de Identidad
 * para aplicarlos en la Ficha Única sin duplicar a la usuaria ni exponer CURP en toasts.
 */
export function BannerPrecargaMovil({ preRegistro, confirmed, onConfirm, onDismiss }: Props) {
  function handleConfirm() {
    onConfirm(preRegistro);
    toast('Datos de la app móvil aplicados a la ficha.');
  }

  return (
    <section
      aria-live="polite"
      className={`rounded-2xl border p-4 transition-colors ${
        confirmed
          ? 'border-status-success/40 bg-status-success-bg/35'
          : 'border-status-info/40 bg-status-info-bg/35'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
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
            <p className="text-sm font-semibold text-on-surface">
              {confirmed ? 'Datos de la app aplicados' : 'Datos de la app encontrados'}
            </p>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              {confirmed
                ? 'Se precargaron nombre, apellidos, fecha de nacimiento, sexo y entidad.'
                : 'Existe un pre-registro móvil activo para esta CURP. Puedes precargar sus datos.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!confirmed ? (
            <button type="button" className="mk-button mk-button--filled" onClick={handleConfirm}>
              <Icon name="download_done" />
              <span>Usar estos datos</span>
            </button>
          ) : null}
          <button type="button" className="mk-button mk-button--text" onClick={onDismiss}>
            Omitir
          </button>
        </div>
      </div>

      <dl className="mt-3 grid gap-3 rounded-xl bg-surface-container-lowest/90 p-3.5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-on-surface-variant">Nombre completo</dt>
          <dd className="mt-0.5 font-medium text-on-surface">{preRegistro.nombreCompleto}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-on-surface-variant">Fecha de nacimiento</dt>
          <dd className="mt-0.5 font-mono text-on-surface">{preRegistro.fechaNacimiento}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-on-surface-variant">Sexo / Entidad</dt>
          <dd className="mt-0.5 text-on-surface">
            {formatSexoLabel(preRegistro.sexo)} · {preRegistro.entidadNacimiento}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-on-surface-variant">Teléfono celular</dt>
          <dd className="mt-0.5 font-mono text-on-surface">
            {preRegistro.celular ?? 'No proporcionado'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
