import type { ReactNode } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import { estadoActividad, type ActividadPreventivaItem } from '@/domain/models/ActividadPreventiva';
import { ROLE_LABELS, type StaffRole } from '@/domain/models/Auth';
import { ActividadEstadoChip, ActividadInstitucionChip } from './ActividadChips';
import { fechaLargaActividad, horaActividad } from './actividadesList';

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">{label}</dt>
      <dd className="text-sm text-on-surface">{children}</dd>
    </div>
  );
}

/** Vista de detalle de una actividad (solo lectura: la base no ofrece RPC de edición). */
export function ActividadDetalle({ actividad, ahora, onClose }: { actividad: ActividadPreventivaItem; ahora: Date; onClose: () => void }) {
  const estado = estadoActividad(actividad, ahora);
  const colonia = [actividad.asentamientoNombre, actividad.codigoPostal ? `CP ${actividad.codigoPostal}` : null, actividad.municipio]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Dialog.Body className="act-view">
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <ActividadEstadoChip estado={estado} />
            <ActividadInstitucionChip tipo={actividad.tipoInstitucion} nivel={actividad.nivelEducativo} />
            <span className="act-chip bg-surface-container-high text-on-surface-variant">{actividad.tipoActividadNombre}</span>
          </div>

          <dl className="grid gap-4 rounded-2xl bg-surface-container-low p-4 sm:grid-cols-2">
            <Dato label="Fecha">{fechaLargaActividad(actividad.programadaEn)}</Dato>
            <Dato label="Hora (Mazatlán)">{horaActividad(actividad.programadaEn)}</Dato>
            <Dato label="Sede">{actividad.sede}</Dato>
            <Dato label="Asistentes">{actividad.numeroAsistentes ?? 'Sin dato'}</Dato>
            <Dato label="Colonia">{colonia || 'Sin especificar'}</Dato>
            <Dato label="Dirección">{actividad.direccion ?? 'Sin especificar'}</Dato>
            {actividad.referencias ? (
              <div className="sm:col-span-2">
                <Dato label="Referencias">{actividad.referencias}</Dato>
              </div>
            ) : null}
          </dl>

          <section aria-label="Personal participante" className="grid gap-2">
            <h3 className="text-sm font-semibold text-on-surface">Personal participante</h3>
            {actividad.participantes.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Sin personal asignado.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {actividad.participantes.map((p) => (
                  <li key={p.empleadoId} className="act-chip bg-surface-container-high text-on-surface">
                    {p.nombre}
                    <span className="text-on-surface-variant"> · {ROLE_LABELS[p.rol as StaffRole] ?? p.rol}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {actividad.creadoPorNombre ? (
            <p className="text-xs text-on-surface-variant">Registrada por {actividad.creadoPorNombre}.</p>
          ) : null}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <button type="button" className="mk-button mk-button--tonal act-btn" onClick={onClose}>
          Cerrar
        </button>
      </Dialog.Footer>
    </>
  );
}
