import { Link } from 'react-router-dom';
import { Icon } from '@/shared/ui/Icon';
import { useAlertsSummary, useCasesSummary, useSchedulingSummary } from '../api';
import { dayAndTime } from './format';

interface Props {
  userId: string;
  mine: boolean;
  canViewAlerts: boolean;
  canViewCases: boolean;
}

const CARD_BASE =
  'flex min-h-34 flex-col justify-between rounded-3xl border p-5 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary';

/**
 * KPIs operativos del Dashboard:
 * - Todas las tarjetas son enlaces accionables hacia su módulo (no contadores decorativos).
 * - Superficie uniforme cuando el conteo es 0; el énfasis semántico (peligro/aviso) solo
 *   se activa cuando hay alertas o casos prioritarios reales (> 0).
 * - Terminología institucional ("Casos prioritarios") y sin nombres personales (LGPDPPSO).
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
        <Link
          to="/solicitudes"
          className={`${CARD_BASE} ${
            activeAlerts > 0
              ? 'border-status-danger/40 bg-status-danger-bg/50'
              : 'border-outline-variant bg-surface-container-lowest'
          }`}
        >
          <div className="flex items-center justify-between text-on-surface-variant">
            <p className="text-sm font-medium">Alertas pendientes</p>
            <Icon
              name="notifications_active"
              filled={activeAlerts > 0}
              className={activeAlerts > 0 ? 'text-status-danger' : 'text-on-surface-variant'}
            />
          </div>
          <p className={`mt-3 text-4xl font-medium tracking-tight tabular-nums ${activeAlerts > 0 ? 'text-status-danger' : 'text-on-surface'}`}>
            {alerts.data ? activeAlerts : '—'}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {alerts.data
              ? `${alerts.data.newToday} nuevas hoy · ${alerts.data.inProgress} tomadas`
              : 'Cargando alertas…'}
          </p>
        </Link>
      )}

      <Link to="/agenda" className={`${CARD_BASE} border-outline-variant bg-surface-container-lowest`}>
        <div className="flex items-center justify-between text-on-surface-variant">
          <p className="text-sm font-medium">Citas de hoy</p>
          <Icon name="event" className="text-status-info" />
        </div>
        <p className="mt-3 text-4xl font-medium tracking-tight tabular-nums text-on-surface">
          {agenda.data ? agenda.data.today : '—'}
        </p>
        <p className="mt-1 truncate text-xs text-on-surface-variant">
          {agenda.data?.nextAt
            ? `Próxima: ${dayAndTime(agenda.data.nextAt)} · ${agenda.data.nextArea ?? 'Área'}`
            : agenda.isLoading
              ? 'Cargando agenda…'
              : 'Sin citas próximas programadas'}
        </p>
      </Link>

      {canViewCases && (
        <>
          <Link to="/expedientes" className={`${CARD_BASE} border-outline-variant bg-surface-container-lowest`}>
            <div className="flex items-center justify-between text-on-surface-variant">
              <p className="text-sm font-medium">{mine ? 'Mis expedientes activos' : 'Expedientes activos'}</p>
              <Icon name="folder_shared" className="text-primary" />
            </div>
            <p className="mt-3 text-4xl font-medium tracking-tight tabular-nums text-on-surface">
              {cases.data ? activeCases : '—'}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              {cases.data
                ? `${cases.data.open} abiertos · ${cases.data.inFollowUp} en seguimiento`
                : 'Cargando expedientes…'}
            </p>
          </Link>

          <Link
            to="/expedientes"
            className={`${CARD_BASE} ${
              priorityCases > 0
                ? 'border-status-warning/40 bg-status-warning-bg/40'
                : 'border-outline-variant bg-surface-container-lowest'
            }`}
          >
            <div className="flex items-center justify-between text-on-surface-variant">
              <p className="text-sm font-medium">Casos prioritarios</p>
              <Icon
                name="priority_high"
                className={priorityCases > 0 ? 'text-status-warning' : 'text-on-surface-variant'}
              />
            </div>
            <p className={`mt-3 text-4xl font-medium tracking-tight tabular-nums ${priorityCases > 0 ? 'text-status-warning' : 'text-on-surface'}`}>
              {cases.data ? priorityCases : '—'}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              {priorityCases > 0 ? 'Requieren seguimiento prioritario' : 'Sin casos prioritarios pendientes'}
            </p>
          </Link>
        </>
      )}
    </div>
  );
}
