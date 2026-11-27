import { Link } from 'react-router-dom';
import { Icon } from '@/shared/ui/Icon';
import { useAlertsSummary, useCasesSummary, useSchedulingSummary } from '../api';

interface Props {
  userId: string;
  mine: boolean;
  canViewAlerts: boolean;
  canViewCases: boolean;
}

const CARD_CLASS =
  'flex flex-col justify-between gap-3 rounded-3xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary';

/**
 * Tarjetas de resumen informativo del Dashboard:
 * superficie neutra del tema, solo etiqueta y cifra, sin tonos ni textos secundarios.
 */
export function KpisWidget({ userId, mine, canViewAlerts, canViewCases }: Props) {
  const alerts = useAlertsSummary(canViewAlerts);
  const cases = useCasesSummary(userId, canViewCases);
  const agenda = useSchedulingSummary(true);

  const activeAlerts = alerts.data?.active ?? 0;
  const activeCases = mine ? (cases.data?.mine ?? 0) : (cases.data?.open ?? 0) + (cases.data?.inFollowUp ?? 0);
  const priorityCases = cases.data?.urgencias ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {canViewAlerts && (
        <Link to="/solicitudes" className={CARD_CLASS}>
          <div className="flex items-center justify-between text-on-surface-variant">
            <p className="text-sm font-medium">Alertas pendientes</p>
            <Icon name="notifications_active" className="text-on-surface-variant" />
          </div>
          <p className="text-4xl font-medium tracking-tight tabular-nums text-on-surface">
            {alerts.data ? activeAlerts : '—'}
          </p>
        </Link>
      )}

      <Link to="/agenda" className={CARD_CLASS}>
        <div className="flex items-center justify-between text-on-surface-variant">
          <p className="text-sm font-medium">Citas de hoy</p>
          <Icon name="event" className="text-on-surface-variant" />
        </div>
        <p className="text-4xl font-medium tracking-tight tabular-nums text-on-surface">
          {agenda.data ? agenda.data.today : '—'}
        </p>
      </Link>

      {canViewCases && (
        <>
          <Link to="/expedientes" className={CARD_CLASS}>
            <div className="flex items-center justify-between text-on-surface-variant">
              <p className="text-sm font-medium">{mine ? 'Mis expedientes activos' : 'Expedientes activos'}</p>
              <Icon name="folder_shared" className="text-on-surface-variant" />
            </div>
            <p className="text-4xl font-medium tracking-tight tabular-nums text-on-surface">
              {cases.data ? activeCases : '—'}
            </p>
          </Link>

          <Link to="/expedientes" className={CARD_CLASS}>
            <div className="flex items-center justify-between text-on-surface-variant">
              <p className="text-sm font-medium">Casos prioritarios</p>
              <Icon name="priority_high" className="text-on-surface-variant" />
            </div>
            <p className="text-4xl font-medium tracking-tight tabular-nums text-on-surface">
              {cases.data ? priorityCases : '—'}
            </p>
          </Link>
        </>
      )}
    </div>
  );
}
