import {
  ESTADO_DERIVACION_LABELS,
  type CanalizacionEvento,
  type EstadoDerivacion,
} from '@/domain/models/Derivacion';
import { getEstadoDotClass } from './DerivacionStatusChip';
import { formatMomento, ordenarEventos } from './derivacionFormat';

interface DerivacionHistorialProps {
  eventos: readonly CanalizacionEvento[];
  /** Fecha de creación: se usa como evento de registro si el historial no está disponible. */
  creadoEn: string;
  loading: boolean;
}

function descripcionEvento(evento: CanalizacionEvento): string {
  if (!evento.estadoAnterior && evento.estadoNuevo) return 'Canalización registrada';
  if (evento.estadoAnterior && evento.estadoNuevo) {
    return `De ${ESTADO_DERIVACION_LABELS[evento.estadoAnterior]} a ${ESTADO_DERIVACION_LABELS[evento.estadoNuevo]}`;
  }
  return 'Actualización de la canalización';
}

function dotClass(estado: EstadoDerivacion | null): string {
  return estado ? getEstadoDotClass(estado) : 'bg-outline';
}

/** Subtimeline compacta con los cambios de estado de una canalización (solo lectura). */
export function DerivacionHistorial({ eventos, creadoEn, loading }: DerivacionHistorialProps) {
  const lista = ordenarEventos(eventos);

  return (
    <div>
      <p className="vc-canal-history__label">
        Historial de estados
      </p>
      {loading && lista.length === 0 ? (
        <p className="vc-canal-history__muted">Cargando historial…</p>
      ) : (
        <ol className="vc-canal-history" aria-label="Historial de estados">
          {lista.length === 0 ? (
            <li className="vc-canal-history__item">
              <span aria-hidden="true" className={`vc-canal-history__dot ${dotClass('pendiente')}`} />
              <span>Canalización registrada</span>
              <p className="vc-canal-history__meta">{formatMomento(creadoEn)}</p>
            </li>
          ) : (
            lista.map((evento, i) => (
              <li key={`${evento.fecha}-${i}`} className="vc-canal-history__item">
                <span
                  aria-hidden="true"
                  className={`vc-canal-history__dot ${dotClass(evento.estadoNuevo)}`}
                />
                <span>{descripcionEvento(evento)}</span>
                <p className="vc-canal-history__meta">
                  {formatMomento(evento.fecha)}
                  {evento.actorNombre ? ` · ${evento.actorNombre}` : ''}
                </p>
                {evento.nota ? <p className="vc-canal-history__note">{evento.nota}</p> : null}
              </li>
            ))
          )}
        </ol>
      )}
    </div>
  );
}
