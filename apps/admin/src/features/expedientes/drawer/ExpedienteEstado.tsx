import { memo, type CSSProperties } from 'react';
import { ESTADO_FICHA_LABELS, type EstadoFicha, type ExpedienteResumen } from '@/domain/models/Persona';
import { Icon } from '@/shared/ui/Icon';
import { formatFechaCorta, formatTiempoRelativo } from './formatters';
import './expediente-estado.css';

type EstadoTone = 'info' | 'warning' | 'success' | 'neutral';

interface EstadoMeta {
  tone: EstadoTone;
  icon: string;
  /** Frase corta que explica qué significa el estado para el personal. */
  hint: string;
}

/** Tono por estado: coherente con las cápsulas de la tabla de expedientes (info / warning / success). */
const ESTADO_META: Record<EstadoFicha, EstadoMeta> = {
  abierto: {
    tone: 'info',
    icon: 'folder_open',
    hint: 'Expediente recién abierto, pendiente de iniciar el seguimiento.',
  },
  en_seguimiento: {
    tone: 'warning',
    icon: 'sync',
    hint: 'Hay intervenciones en curso con la usuaria.',
  },
  cerrado: {
    tone: 'success',
    icon: 'task_alt',
    hint: 'El caso concluyó; puede reabrirse si es necesario.',
  },
  archivado: {
    tone: 'neutral',
    icon: 'inventory_2',
    hint: 'Fuera del flujo activo; se conserva solo para consulta.',
  },
};

/** Ciclo de vida activo (el archivado queda fuera del flujo) con el nombre de cada fase. */
const ESTADO_STEPS: ReadonlyArray<{ estado: EstadoFicha; label: string }> = [
  { estado: 'abierto', label: 'Apertura' },
  { estado: 'en_seguimiento', label: 'Seguimiento' },
  { estado: 'cerrado', label: 'Cierre' },
];

interface EstadoPillProps {
  estado: EstadoFicha;
  size?: 'sm' | 'md';
}

/** Cápsula de estado: color por token semántico + ícono; el cambio de estado la hace «saltar» una vez. */
export const EstadoPill = memo(function EstadoPill({ estado, size = 'sm' }: EstadoPillProps) {
  const meta = ESTADO_META[estado];
  return (
    <span key={estado} className="vc-estado-pill" data-tone={meta.tone} data-size={size}>
      <Icon name={meta.icon} filled className="vc-estado-pill__icon" />
      <span>{ESTADO_FICHA_LABELS[estado]}</span>
    </span>
  );
});

/** Cápsula de prioridad (lista de urgencias). */
export const PrioridadPill = memo(function PrioridadPill({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span className="vc-estado-pill" data-tone="danger" data-size={size}>
      <Icon name="priority_high" filled className="vc-estado-pill__icon" />
      <span>Urgente</span>
    </span>
  );
});

const EstadoProgress = memo(function EstadoProgress({ estado }: { estado: EstadoFicha }) {
  const current = ESTADO_STEPS.findIndex((step) => step.estado === estado);

  if (current < 0) {
    return (
      <p className="vc-estado-note">
        <Icon name="inventory_2" className="text-[18px]" />
        <span>Archivado: ya no forma parte del flujo activo.</span>
      </p>
    );
  }

  return (
    <ol className="vc-estado-steps" aria-label="Progreso del expediente">
      {ESTADO_STEPS.map(({ estado: stepEstado, label }, index) => {
        const status = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li
            key={stepEstado}
            className="vc-estado-step"
            data-status={status}
            aria-current={status === 'current' ? 'step' : undefined}
            style={{ '--vc-step-index': index } as CSSProperties}
          >
            <span className="vc-estado-step__dot" aria-hidden>
              {status === 'done' ? (
                <Icon name="check" className="text-[16px]" />
              ) : (
                <span className="vc-estado-step__core" />
              )}
            </span>
            <span className="vc-estado-step__label">{label}</span>
            <span className="sr-only">
              {status === 'done' ? ' (completado)' : status === 'current' ? ' (etapa actual)' : ' (pendiente)'}
            </span>
          </li>
        );
      })}
    </ol>
  );
});

/** Tarjeta de estado: cápsula, prioridad, avance del ciclo de vida y fechas de apertura/actualización. */
export const ExpedienteEstadoCard = memo(function ExpedienteEstadoCard({
  expediente,
}: {
  expediente: ExpedienteResumen;
}) {
  const meta = ESTADO_META[expediente.estado];
  const abierto = formatFechaCorta(expediente.creadoEn);
  const actualizado = formatTiempoRelativo(expediente.actualizadoEn);

  return (
    <section aria-label="Estado del expediente" className="vc-estado-card" data-tone={meta.tone}>
      <header className="vc-estado-card__head">
        <p className="vc-estado-card__title">Estado del expediente</p>
        <div className="vc-estado-card__pills">
          <EstadoPill estado={expediente.estado} size="md" />
          {expediente.enListaUrgencias ? <PrioridadPill size="md" /> : null}
        </div>
      </header>

      <p className="vc-estado-card__hint">{meta.hint}</p>

      <EstadoProgress estado={expediente.estado} />

      {abierto || actualizado ? (
        <p className="vc-estado-card__meta">
          <Icon name="schedule" className="text-[18px]" />
          <span>
            {abierto ? `Abierto el ${abierto}` : null}
            {abierto && actualizado ? ' · ' : null}
            {actualizado ? `Actualizado ${actualizado}` : null}
          </span>
        </p>
      ) : null}
    </section>
  );
});
