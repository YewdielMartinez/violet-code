import { Icon } from '@/shared/ui/Icon';
import {
  DROGA_LABELS,
  TIPO_ARMA_LABELS,
  formatAgresorNombre,
  type Agresor,
} from '../agresorApi';
import { AgresorDialog } from './motionCompat';

interface AgresorCardProps {
  agresor: Agresor;
  parentescoLabel: string | null;
  ocupacionLabel: string | null;
  domicilioResumen: string;
  onEdit: (agresor: Agresor) => void;
}

function getIniciales(agresor: Agresor): string {
  const parts = [agresor.nombres, agresor.apellidoPaterno]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean);
  if (parts.length === 0) return 'PA';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function AgresorCard({
  agresor,
  parentescoLabel,
  ocupacionLabel,
  domicilioResumen,
  onEdit,
}: AgresorCardProps) {
  const subtitulo = [parentescoLabel, ocupacionLabel].filter(Boolean).join(' · ');

  return (
    <article
      data-flip-id={agresor.id}
      data-mk-cascade="fade"
      className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-outline motion-reduce:transition-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-xs font-semibold text-on-primary-container"
          >
            {getIniciales(agresor)}
          </span>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-on-surface">
              {formatAgresorNombre(agresor)}
            </h4>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              {subtitulo || 'Sin parentesco ni ocupación registrados'}
            </p>
          </div>
        </div>

        <AgresorDialog.Trigger
          className="mk-button mk-button--tonal mk-button--sm shrink-0"
          onClick={() => onEdit(agresor)}
        >
          <Icon name="edit" />
          <span>Editar</span>
        </AgresorDialog.Trigger>
      </div>

      {domicilioResumen ? (
        <p className="flex items-start gap-1.5 text-xs text-on-surface-variant">
          <Icon name="location_on" className="mt-0.5 shrink-0 text-[16px] text-primary" />
          <span>
            <span className="font-medium text-on-surface">Domicilio:</span> {domicilioResumen}
          </span>
        </p>
      ) : null}

      {agresor.tieneConsumoDroga === true || agresor.utilizoArmaUObjeto === true ? (
        <div className="flex flex-wrap gap-1.5">
          {agresor.tieneConsumoDroga === true ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-medium text-status-warning">
              <Icon name="medication" className="text-[14px]" />
              <span>
                Consumo de drogas
                {agresor.drogas?.length
                  ? `: ${agresor.drogas.map((d) => DROGA_LABELS[d]).join(', ')}`
                  : ''}
              </span>
            </span>
          ) : null}

          {agresor.utilizoArmaUObjeto === true ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-danger-bg px-2.5 py-0.5 text-xs font-medium text-status-danger">
              <Icon name="warning" className="text-[14px]" />
              <span>
                Utilizó arma u objeto
                {agresor.tipoArma ? `: ${TIPO_ARMA_LABELS[agresor.tipoArma]}` : ''}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      {agresor.observaciones ? (
        <p className="line-clamp-3 text-xs text-on-surface-variant">{agresor.observaciones}</p>
      ) : null}
    </article>
  );
}
