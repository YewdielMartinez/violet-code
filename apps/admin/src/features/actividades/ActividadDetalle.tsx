import { useId, useState } from 'react';
import { Dialog, toast } from '@yewdiel21/motion-kit/react';
import {
  accionesActividad,
  aplicarCambioEstado,
  esVencida,
  validateCambioEstadoActividad,
  type ActividadEstadoCambioInput,
} from '@/domain/models/ActividadEstado';
import type { ActividadPreventivaItem } from '@/domain/models/ActividadPreventiva';
import { ROLE_LABELS, type StaffRole } from '@/domain/models/Auth';
import { DialogActionsMenu, type DialogMenuItem } from '@/shared/ui/DialogActionsMenu';
import type { DialogDir } from '@/shared/ui/DialogHeader';
import { CardDato, CardDatos, CardFieldDato, CardNote, TonalCard, TonalCardGrid } from '@/shared/ui/TonalCard';
import { useCambiarEstadoActividad } from './api';
import {
  ActividadEstadoChip,
  ActividadInstitucionChip,
  ActividadTipoChip,
  ActividadVencidaChip,
} from './ActividadChips';
import { CancelarActividadPanel, RealizarPanel } from './ActividadPanels';
import { fechaLargaActividad, horaActividad, mensajeError } from './actividadesList';

type Modo = 'realizar' | 'cancelar' | null;

const MENU_CANCELAR: readonly DialogMenuItem[] = [{ value: 'cancelar', label: 'Cancelar actividad', icon: 'cancel' }];

export interface ActividadDetalleProps {
  actividad: ActividadPreventivaItem;
  /** Momento de referencia de la pantalla (decide si una pendiente está vencida). */
  ahora: Date;
  dir: DialogDir;
  /** `actividad.registrar`: dirección y áreas de atención ven las acciones de estado. */
  puedeRegistrar: boolean;
  /** Aplica un cambio local a la actividad para que la vista refleje el estado al instante (y lo revierte si falla). */
  onPatch: (actividadId: string, patch: Partial<ActividadPreventivaItem>) => void;
  /** Hueco del encabezado del diálogo donde se monta el menú ⋮ de acciones secundarias. */
  accionesSlot?: HTMLElement | null;
}

/** Campos que cambia una transición: se guardan antes del cambio optimista para poder revertirlo. */
function camposDeEstado(a: ActividadPreventivaItem): Partial<ActividadPreventivaItem> {
  return {
    estado: a.estado,
    realizadaEn: a.realizadaEn,
    canceladaMotivo: a.canceladaMotivo,
    observacionesCierre: a.observacionesCierre,
    numeroAsistentes: a.numeroAsistentes,
  };
}

/**
 * Vista «detalle» de una actividad con la misma estructura que el detalle de la cita: tarjeta ancha con el título,
 * tarjetas tonales en dos columnas y acciones válidas según el estado — primarias en el pie (marcar realizada /
 * reabrir) y la secundaria (cancelar) en el menú ⋮ del encabezado. Los paneles de cierre y cancelación reemplazan
 * la rejilla dentro del mismo diálogo. El cambio de estado es optimista.
 */
export function ActividadDetalle({ actividad, ahora, dir, puedeRegistrar, onPatch, accionesSlot }: ActividadDetalleProps) {
  const formId = useId();
  const cambiarEstado = useCambiarEstadoActividad();

  const [modo, setModo] = useState<Modo>(null);
  const [asistentes, setAsistentes] = useState(() => (actividad.numeroAsistentes === null ? '' : String(actividad.numeroAsistentes)));
  const [observaciones, setObservaciones] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const acciones = accionesActividad(actividad.estado, puedeRegistrar);
  const hayAcciones = acciones.realizar || acciones.cancelar || acciones.reabrir;
  const vencida = esVencida(actividad, ahora);
  const pending = cambiarEstado.isPending;

  const colonia = [actividad.asentamientoNombre, actividad.codigoPostal ? `CP ${actividad.codigoPostal}` : null, actividad.municipio]
    .filter(Boolean)
    .join(' · ');

  function abrirModo(next: Modo) {
    setError(null);
    if (next === 'realizar') setAsistentes(actividad.numeroAsistentes === null ? '' : String(actividad.numeroAsistentes));
    setModo(next);
  }

  async function cambiar(input: ActividadEstadoCambioInput, mensaje: string) {
    const invalido = validateCambioEstadoActividad(actividad.estado, input);
    if (invalido) {
      setError(invalido);
      toast(invalido, { tone: 'error' });
      return;
    }
    setError(null);
    const modoPrevio = modo;
    const antes = camposDeEstado(actividad);
    // Optimista: la vista y la lista cambian de inmediato; si el servidor lo rechaza se revierte.
    onPatch(actividad.id, camposDeEstado(aplicarCambioEstado(actividad, input, new Date().toISOString())));
    setModo(null);
    try {
      await cambiarEstado.mutateAsync(input);
      toast(mensaje, { tone: 'success' });
    } catch (err) {
      onPatch(actividad.id, antes);
      setModo(modoPrevio);
      const message = mensajeError(err, 'No se pudo actualizar la actividad.');
      setError(message);
      toast(message, { tone: 'error' });
    }
  }

  function realizar() {
    const texto = asistentes.trim();
    void cambiar(
      {
        actividadId: actividad.id,
        estado: 'realizada',
        numeroAsistentes: texto === '' ? null : Number(texto),
        observaciones: observaciones.trim() || null,
      },
      'Actividad marcada como realizada.',
    );
  }

  function cancelar() {
    void cambiar(
      { actividadId: actividad.id, estado: 'cancelada', motivoCancelacion: motivo.trim() || null },
      'Actividad cancelada.',
    );
  }

  function reabrir() {
    void cambiar({ actividadId: actividad.id, estado: 'pendiente' }, 'Actividad reabierta como pendiente.');
  }

  return (
    <>
      <DialogActionsMenu
        slot={accionesSlot}
        items={acciones.cancelar && modo === null ? MENU_CANCELAR : []}
        disabled={pending}
        onSelect={() => abrirModo('cancelar')}
      />

      <Dialog.Body className="vc-dlg-view" data-dir={dir}>
        {modo === 'realizar' ? (
          <RealizarPanel
            formId={formId}
            onSubmit={realizar}
            disabled={pending}
            error={error}
            asistentes={asistentes}
            onAsistentesChange={setAsistentes}
            observaciones={observaciones}
            onObservacionesChange={setObservaciones}
          />
        ) : modo === 'cancelar' ? (
          <CancelarActividadPanel
            formId={formId}
            onSubmit={cancelar}
            disabled={pending}
            error={error}
            motivo={motivo}
            onMotivoChange={setMotivo}
          />
        ) : (
          <TonalCardGrid>
            <TonalCard title="Resumen" wide>
              <p className="act-detalle__titulo">{actividad.titulo}</p>
              <div className="vc-chips">
                <ActividadEstadoChip estado={actividad.estado} />
                {vencida ? <ActividadVencidaChip /> : null}
                <ActividadInstitucionChip tipo={actividad.tipoInstitucion} nivel={actividad.nivelEducativo} />
                <ActividadTipoChip nombre={actividad.tipoActividadNombre} />
              </div>
              {vencida ? (
                <CardNote icon="warning">
                  La fecha ya pasó y sigue pendiente. Márcala como realizada o cancélala para cerrarla.
                </CardNote>
              ) : null}
            </TonalCard>

            <TonalCard title="Fecha y hora">
              <CardDatos>
                <CardFieldDato label="Día" icon="calendar_month">
                  {fechaLargaActividad(actividad.programadaEn)}
                </CardFieldDato>
                <CardFieldDato label="Hora (Mazatlán)" icon="schedule">
                  {horaActividad(actividad.programadaEn)}
                </CardFieldDato>
                {actividad.estado === 'realizada' && actividad.realizadaEn ? (
                  <CardFieldDato label="Realizada el" icon="check_circle">
                    {fechaLargaActividad(actividad.realizadaEn)}, {horaActividad(actividad.realizadaEn)}
                  </CardFieldDato>
                ) : null}
              </CardDatos>
            </TonalCard>

            <TonalCard title="Lugar">
              <CardDatos>
                <CardFieldDato label="Sede" icon="location_on">
                  {actividad.sede}
                </CardFieldDato>
                <CardDato label="Colonia">{colonia || 'Sin especificar'}</CardDato>
                <CardDato label="Dirección">{actividad.direccion ?? 'Sin especificar'}</CardDato>
                {actividad.referencias ? <CardDato label="Referencias">{actividad.referencias}</CardDato> : null}
              </CardDatos>
            </TonalCard>

            <TonalCard title={actividad.estado === 'cancelada' ? 'Cancelación' : 'Asistencia y cierre'}>
              <CardDatos>
                {actividad.estado === 'cancelada' ? (
                  <CardDato label="Motivo">{actividad.canceladaMotivo ?? 'Sin motivo indicado'}</CardDato>
                ) : (
                  <>
                    <CardDato label="Asistentes">{actividad.numeroAsistentes ?? 'Sin dato'}</CardDato>
                    {actividad.estado === 'realizada' ? (
                      <CardDato label="Observaciones de cierre">{actividad.observacionesCierre ?? 'Sin observaciones'}</CardDato>
                    ) : null}
                  </>
                )}
              </CardDatos>
            </TonalCard>

            <TonalCard title="Personal participante" wide>
              {actividad.participantes.length === 0 ? (
                <p className="vc-value">Sin personal asignado.</p>
              ) : (
                <ul className="vc-chips" aria-label="Personal participante">
                  {actividad.participantes.map((p) => (
                    <li key={p.empleadoId} className="vc-chip bg-surface-container-high text-on-surface">
                      {p.nombre}
                      <span className="font-normal text-on-surface-variant">· {ROLE_LABELS[p.rol as StaffRole] ?? p.rol}</span>
                    </li>
                  ))}
                </ul>
              )}
            </TonalCard>

            {actividad.creadoPorNombre ? (
              <CardNote icon="person" wide>
                Registrada por {actividad.creadoPorNombre}.
              </CardNote>
            ) : null}
            {!hayAcciones ? (
              <CardNote icon="info" wide>
                {puedeRegistrar ? 'Esta actividad ya no admite cambios de estado.' : 'Tu rol no puede modificar esta actividad.'}
              </CardNote>
            ) : null}
            {error && modo === null ? (
              <p role="alert" className="vc-error">
                {error}
              </p>
            ) : null}
          </TonalCardGrid>
        )}
      </Dialog.Body>

      {modo !== null ? (
        <Dialog.Footer key="form">
          <button key="volver" type="button" className="mk-button mk-button--text vc-press" disabled={pending} onClick={() => abrirModo(null)}>
            Volver
          </button>
          <button key="enviar" type="submit" form={formId} className="mk-button mk-button--filled vc-press" disabled={pending}>
            {modo === 'realizar' ? (pending ? 'Guardando…' : 'Marcar como realizada') : pending ? 'Cancelando…' : 'Confirmar cancelación'}
          </button>
        </Dialog.Footer>
      ) : acciones.realizar || acciones.reabrir ? (
        <Dialog.Footer key="acciones">
          {acciones.reabrir ? (
            <button key="reabrir" type="button" className="mk-button mk-button--tonal vc-press" disabled={pending} onClick={reabrir}>
              Reabrir
            </button>
          ) : null}
          {acciones.realizar ? (
            <button key="abrir-realizar" type="button" className="mk-button mk-button--filled vc-press" disabled={pending} onClick={() => abrirModo('realizar')}>
              Marcar como realizada
            </button>
          ) : null}
        </Dialog.Footer>
      ) : null}
    </>
  );
}
