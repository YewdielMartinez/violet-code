import { useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import '../datos/datos.css';
import { formatConsumoDrogas } from '@/domain/models/ConsumoDrogas';
import {
  formatAgresorNombre,
  type Agresor,
} from '../agresorApi';
import { AgresorDialog } from './motionCompat';

interface AgresorCardProps {
  agresor: Agresor;
  parentescoLabel: string | null;
  ocupacionLabel: string | null;
  domicilioResumen: string;
  readOnly?: boolean;
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
  readOnly = false,
  onEdit,
}: AgresorCardProps) {
  const subtitulo = [parentescoLabel, ocupacionLabel].filter(Boolean).join(' · ');

  // Tras guardar (o refetch) la tarjeta recibe un velo tonal una sola vez para mostrar que cambió.
  const [seenVersion, setSeenVersion] = useState(agresor.actualizadoEn);
  const [flashKey, setFlashKey] = useState(0);
  if (seenVersion !== agresor.actualizadoEn) {
    setSeenVersion(agresor.actualizadoEn);
    setFlashKey((key) => key + 1);
  }
  const consumoLabel = formatConsumoDrogas(agresor.drogas, agresor.especificacionDroga);
  const noConsume = agresor.drogas?.includes('no_consume') === true;

  return (
    <article
      data-flip-id={agresor.id}
      data-mk-cascade="fade"
      className="vc-agresor-card grid gap-3.5 rounded-2xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-outline motion-reduce:transition-none"
    >
      {flashKey > 0 ? <span key={flashKey} aria-hidden className="vc-dato__flash" /> : null}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-base font-semibold text-on-secondary-container"
          >
            {getIniciales(agresor)}
          </span>
          <div className="min-w-0">
            <h4 className="vc-agresor-card__title truncate">
              {formatAgresorNombre(agresor)}
            </h4>
            <p className="vc-agresor-card__sub">
              {subtitulo || 'Sin parentesco ni ocupación registrados'}
            </p>
          </div>
        </div>

        {!readOnly ? (
          <AgresorDialog.Trigger
            className="mk-button mk-button--tonal shrink-0"
            onClick={() => onEdit(agresor)}
          >
            Editar
          </AgresorDialog.Trigger>
        ) : null}
      </div>

      {domicilioResumen ? (
        <p className="vc-agresor-card__line">
          <strong>Domicilio:</strong> {domicilioResumen}
        </p>
      ) : null}

      {consumoLabel || Boolean(agresor.especificacionArma) ? (
        <div className="flex flex-wrap gap-1.5">
          {consumoLabel ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                noConsume
                  ? 'bg-surface-container-high text-on-surface-variant'
                  : 'bg-status-warning-bg text-status-warning'
              }`}
            >
              <Icon name="medication" className="text-[18px]" />
              <span>{noConsume ? consumoLabel : `Consumo de drogas: ${consumoLabel}`}</span>
            </span>
          ) : null}

          {agresor.especificacionArma ? (
            <span className="vc-agresor-card__chip bg-status-danger-bg text-status-danger">
              <Icon name="warning" className="text-[18px]" />
              <span>Arma u objeto: {agresor.especificacionArma}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {agresor.observaciones ? (
        <p className="vc-agresor-card__note line-clamp-3">{agresor.observaciones}</p>
      ) : null}
    </article>
  );
}
