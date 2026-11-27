import { useId, useState, type CSSProperties } from 'react';
import { Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/skeleton';
import {
  calcularCambiosVersion,
  HISTORIAL_CLINICO_CAMPO_LABEL,
  type HistorialClinicoVersion,
} from '@/domain/models/HistorialClinico';
import { useHistorialClinicoVersiones } from './historialClinicoApi';
import './historial-clinico.css';

/** Versiones visibles antes de «Mostrar todas». */
const VISIBLE_INITIAL = 5;

const FECHA_HORA_FMT = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Mazatlan',
});

function formatFechaHora(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return FECHA_HORA_FMT.format(date).replace(/\./g, '');
}

interface VersionItemProps {
  version: HistorialClinicoVersion;
  /** Versión inmediata anterior (para mostrar «antes»); `null` en el registro inicial. */
  anterior: HistorialClinicoVersion | null;
  esActual: boolean;
  index: number;
}

function VersionItem({ version, anterior, esActual, index }: VersionItemProps) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const cambios = calcularCambiosVersion(version, anterior);
  const esInicial = anterior === null;
  const autor = version.creadoPorNombre ?? 'Autor no disponible';

  return (
    <li className="vc-hc-ver" style={{ '--i': Math.min(index, 8) } as CSSProperties} data-current={esActual ? 'true' : undefined}>
      <span className="vc-hc-ver__dot" aria-hidden>
        {version.version}
      </span>

      <div className="vc-hc-ver__body">
        <div className="vc-hc-ver__row">
          <div className="vc-hc-ver__meta">
            <p className="vc-hc-ver__title">
              {esInicial ? 'Registro inicial' : `Versión ${version.version}`}
              {esActual ? <span className="vc-hc-ver__badge">Actual</span> : null}
            </p>
            <p className="vc-hc-ver__by">
              {autor} · <time dateTime={version.creadoEn}>{formatFechaHora(version.creadoEn)}</time>
            </p>
          </div>

          {cambios.length > 0 ? (
            <button
              type="button"
              className="mk-button mk-button--text mk-button--sm vc-hc-ver__toggle"
              aria-expanded={open}
              aria-controls={detailId}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? 'Ocultar cambios' : 'Ver cambios'}
            </button>
          ) : null}
        </div>

        {cambios.length > 0 ? (
          <ul className="vc-hc-ver__chips" aria-label="Campos modificados">
            {cambios.map((cambio) => (
              <li key={cambio.campo} className="vc-hc-chip">
                {cambio.label}
              </li>
            ))}
          </ul>
        ) : null}

        <div id={detailId} className="vc-hc-ver__detail" data-open={open ? 'true' : 'false'} inert={open ? undefined : true}>
          <div className="vc-hc-ver__detail-inner">
            {cambios.map((cambio) => (
              <div key={cambio.campo} className="vc-hc-diff">
                <p className="vc-hc-diff__label">{HISTORIAL_CLINICO_CAMPO_LABEL[cambio.campo]}</p>
                <div className="vc-hc-diff__cols" data-initial={esInicial ? 'true' : undefined}>
                  {esInicial ? null : (
                    <div className="vc-hc-diff__col vc-hc-diff__col--before">
                      <p className="vc-hc-diff__tag">Antes</p>
                      <p className="vc-hc-diff__value" data-empty={cambio.antes === null ? 'true' : undefined}>
                        {cambio.antes ?? 'Sin registrar'}
                      </p>
                    </div>
                  )}
                  <div className="vc-hc-diff__col vc-hc-diff__col--after">
                    <p className="vc-hc-diff__tag">{esInicial ? 'Capturado' : 'Después'}</p>
                    <p className="vc-hc-diff__value" data-empty={cambio.despues === null ? 'true' : undefined}>
                      {cambio.despues ?? 'Se dejó vacío'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}

interface HistorialClinicoVersionesProps {
  fichaId: string;
}

/** «Historial de cambios»: cada guardado del historial clínico, con autor, fecha y diff de campos. */
export function HistorialClinicoVersiones({ fichaId }: HistorialClinicoVersionesProps) {
  const versionesQuery = useHistorialClinicoVersiones(fichaId);
  const [showAll, setShowAll] = useState(false);
  const versiones = versionesQuery.data ?? [];
  const visibles = showAll ? versiones : versiones.slice(0, VISIBLE_INITIAL);
  const ocultas = versiones.length - visibles.length;

  return (
    <section aria-label="Historial de cambios" className="vc-hc-vers">
      <header className="vc-hc-vers__head">
        <h4 className="vc-hc__title">Historial de cambios</h4>
        {versiones.length > 0 ? (
          <span className="vc-hc-vers__count">
            {versiones.length === 1 ? '1 versión' : `${versiones.length} versiones`}
          </span>
        ) : null}
      </header>

      {versionesQuery.isError ? (
        <p role="alert" className="vc-hc-vers__empty">
          No se pudo cargar el historial de cambios.{' '}
          <button type="button" className="mk-button mk-button--text mk-button--sm" onClick={() => void versionesQuery.refetch()}>
            Reintentar
          </button>
        </p>
      ) : (
        <Skeleton loading={versionesQuery.isLoading} shape="card" lines={2} label="Cargando historial de cambios">
          {versiones.length === 0 ? (
            <p className="vc-hc-vers__empty">Aún no hay cambios registrados.</p>
          ) : (
            <>
              <ol className="vc-hc-vers__list">
                {visibles.map((version, index) => (
                  <VersionItem
                    key={version.id}
                    version={version}
                    anterior={versiones[index + 1] ?? null}
                    esActual={index === 0}
                    index={index}
                  />
                ))}
              </ol>
              {ocultas > 0 ? (
                <button type="button" className="mk-button mk-button--text mk-button--sm vc-hc-vers__more" onClick={() => setShowAll(true)}>
                  Mostrar las {ocultas} anteriores
                </button>
              ) : null}
            </>
          )}
        </Skeleton>
      )}
    </section>
  );
}
