import { useId, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, Menu, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/menu';
import {
  validarTransicionCita,
  validateReagendarCita,
  type AgendaItem,
  type EstadoCitaGestionable,
} from '@/domain/models/Cita';
import { isAttentionRole, isSupervisor } from '@/domain/models/Auth';
import { useContextoHoja } from '@/features/intervenciones/api';
import { formatHora } from '@/features/intervenciones/formatters';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { CancelarPanel, ReagendarPanel } from './CitaCancelarReagendar';
import { CitaEstadoChip, CitaPrioridadChip, CitaUmecaBadge } from './CitaEstadoChip';
import { useCambiarEstadoCita, useReagendarCita } from './api';
import {
  ORIGEN_LABELS,
  accionesDisponibles,
  aIsoMazatlan,
  areaNombre,
  fechaLargaCita,
  inicialNombre,
  mensajeError,
  propuestaReagendar,
  type CitaDir,
} from './citaDialogUtils';
import { useDialogSettled } from './useDialogSettled';

type Modo = 'cancelar' | 'reagendar' | null;

export interface CitaDetalleProps {
  cita: AgendaItem;
  dir: CitaDir;
  /** Aplica un cambio local a la cita (estado) para que la vista y la lista del día se actualicen al instante. */
  onPatch: (citaId: string, patch: Partial<AgendaItem>) => void;
  /** «Marcó asistió»: abre la hoja de seguimiento (el RPC `registrar_seguimiento` marca la asistencia). */
  onAbrirSeguimiento: (cita: AgendaItem) => void;
  onAgendarSiguiente: (cita: AgendaItem) => void;
  onAbrirCita: (cita: AgendaItem) => void;
  /** Cierra el diálogo (al navegar al expediente). */
  onClose: () => void;
  /** Hueco del encabezado del diálogo (a la derecha del título) donde se monta el menú ⋮ de acciones secundarias. */
  accionesSlot?: HTMLElement | null;
}

function Seccion({ titulo, className = '', children }: { titulo: string; className?: string; children: ReactNode }) {
  return (
    <section className={`vc-cita-card ${className}`}>
      <h3 className="vc-cita-label">{titulo}</h3>
      {children}
    </section>
  );
}

/** Dato de texto: etiqueta chica y apagada arriba, valor debajo. */
function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="vc-cita-dato">
      <dt className="vc-cita-sublabel">{etiqueta}</dt>
      <dd className="vc-cita-value">{children}</dd>
    </div>
  );
}

/** Dato dentro de una caja tipo campo (ícono + valor), como los campos de fecha y hora del formulario. */
function CampoDato({ etiqueta, icono, children }: { etiqueta: string; icono: string; children: ReactNode }) {
  return (
    <div className="vc-cita-dato">
      <dt className="vc-cita-sublabel">{etiqueta}</dt>
      <dd className="vc-cita-field">
        <Icon name={icono} />
        <span>{children}</span>
      </dd>
    </div>
  );
}

/** El menú crea su `<dialog>` imperativamente: se monta a ~60 % del morph; antes, un botón idéntico y quieto. */
const MENU_MAX_WAIT_MS = 420;

interface AccionesMenuProps {
  slot: HTMLElement | null | undefined;
  puedeReagendar: boolean;
  puedeCancelar: boolean;
  disabled: boolean;
  onReagendar: () => void;
  onCancelar: () => void;
}

/** Menú ⋮ del encabezado con las acciones secundarias (Reagendar, Cancelar cita), montado en el hueco del título. */
function AccionesMenu({ slot, puedeReagendar, puedeCancelar, disabled, onReagendar, onCancelar }: AccionesMenuProps) {
  const listo = useDialogSettled(MENU_MAX_WAIT_MS);
  if (!slot || (!puedeReagendar && !puedeCancelar)) return null;

  return createPortal(
    listo ? (
      <Menu.Root
        placement="bottom-end"
        onSelect={(value) => (value === 'reagendar' ? onReagendar() : onCancelar())}
      >
        <Menu.Trigger className="vc-cita-iconbtn" aria-label="Más acciones" disabled={disabled}>
          <Icon name="more_vert" />
        </Menu.Trigger>
        <Menu.Content className="vc-cita-menu">
          {puedeReagendar ? (
            <Menu.Item value="reagendar">
              <Icon name="event_repeat" />
              Reagendar
            </Menu.Item>
          ) : null}
          {puedeCancelar ? (
            <Menu.Item value="cancelar">
              <Icon name="cancel" />
              Cancelar cita
            </Menu.Item>
          ) : null}
        </Menu.Content>
      </Menu.Root>
    ) : (
      <span aria-hidden className="vc-cita-iconbtn">
        <Icon name="more_vert" />
      </span>
    ),
    slot,
  );
}

/** Busca en las consultas de agenda ya cacheadas la cita original de un reagendado (sin pedir nada nuevo). */
function useCitaOriginal(reagendadaDe: string | null): AgendaItem | null {
  const qc = useQueryClient();
  return useMemo(() => {
    if (!reagendadaDe) return null;
    for (const [, data] of qc.getQueriesData<unknown>({ queryKey: ['agenda'] })) {
      if (!Array.isArray(data)) continue;
      const found = (data as Partial<AgendaItem>[]).find((item) => item?.citaId === reagendadaDe);
      if (found) return found as AgendaItem;
    }
    return null;
  }, [qc, reagendadaDe]);
}

/** Vista «detalle»: datos de la cita y acciones válidas según su estado (confirmar, asistió, no asistió, cancelar, reagendar). */
export function CitaDetalle({
  cita,
  dir,
  onPatch,
  onAbrirSeguimiento,
  onAgendarSiguiente,
  onAbrirCita,
  onClose,
  accionesSlot,
}: CitaDetalleProps) {
  const formId = useId();
  const { user } = useAuth();
  const role = user?.role;
  const verExpediente = isSupervisor(role) || isAttentionRole(role);
  const contexto = useContextoHoja(cita.personaId, verExpediente);
  const original = useCitaOriginal(cita.reagendadaDe);
  const cambiarEstado = useCambiarEstadoCita();
  const reagendar = useReagendarCita();

  const [modo, setModo] = useState<Modo>(null);
  const [motivo, setMotivo] = useState('');
  const [cuando, setCuando] = useState<Date | null>(() => propuestaReagendar(cita.programadaEn));
  const [error, setError] = useState<string | null>(null);
  const [reagendadaA, setReagendadaA] = useState<string | null>(null);

  const acciones = accionesDisponibles(cita, role, user?.areaId);
  const hayAcciones = Object.values(acciones).some(Boolean);
  const pending = cambiarEstado.isPending || reagendar.isPending;

  function abrirModo(next: Modo) {
    setError(null);
    setMotivo('');
    setModo(next);
  }

  async function cambiar(estado: EstadoCitaGestionable, mensaje: string, motivoOpcional?: string) {
    const invalido = validarTransicionCita(cita.estado, estado, motivoOpcional);
    if (invalido) {
      setError(invalido);
      toast(invalido, { tone: 'error' });
      return;
    }
    setError(null);
    try {
      await cambiarEstado.mutateAsync({ citaId: cita.citaId, estado, motivo: motivoOpcional });
      onPatch(cita.citaId, { estado });
      setModo(null);
      toast(mensaje, { tone: 'success' });
    } catch (err) {
      const message = mensajeError(err, 'No se pudo actualizar la cita.');
      setError(message);
      toast(message, { tone: 'error' });
    }
  }

  async function reagendarCita() {
    const nuevaFecha = cuando ? aIsoMazatlan(cuando) : '';
    const invalido = validateReagendarCita({ citaId: cita.citaId, nuevaFecha, motivo });
    if (invalido) {
      setError(invalido);
      return;
    }
    setError(null);
    try {
      const result = await reagendar.mutateAsync({ citaId: cita.citaId, nuevaFecha, motivo: motivo.trim() || null });
      onPatch(cita.citaId, { estado: 'reagendada' });
      setReagendadaA(result.programadaEn);
      setModo(null);
      toast(`Cita reagendada: ${fechaLargaCita(result.programadaEn)}, ${formatHora(result.programadaEn)}.`, {
        tone: 'success',
      });
    } catch (err) {
      const message = mensajeError(err, 'No se pudo reagendar la cita.');
      setError(message);
      toast(message, { tone: 'error' });
    }
  }

  const fichaId = contexto.data?.fichaId ?? null;
  const primarias = acciones.noAsistio || acciones.confirmar || acciones.asistio || acciones.agendarSiguiente;

  return (
    <>
      <AccionesMenu
        slot={accionesSlot}
        puedeReagendar={acciones.reagendar && modo === null}
        puedeCancelar={acciones.cancelar && modo === null}
        disabled={pending}
        onReagendar={() => abrirModo('reagendar')}
        onCancelar={() => abrirModo('cancelar')}
      />

      <Dialog.Body className="vc-cita-view" data-dir={dir}>
        {modo === 'cancelar' ? (
          <CancelarPanel
            formId={formId}
            motivo={motivo}
            onMotivoChange={setMotivo}
            onSubmit={() => void cambiar('cancelada', 'Cita cancelada.', motivo.trim() || undefined)}
            disabled={pending}
            error={error}
          />
        ) : modo === 'reagendar' ? (
          <ReagendarPanel
            formId={formId}
            motivo={motivo}
            onMotivoChange={setMotivo}
            cuando={cuando}
            onCuandoChange={setCuando}
            onSubmit={() => void reagendarCita()}
            disabled={pending}
            error={error}
          />
        ) : (
          <div className="vc-cita-detalle">
            <Seccion titulo="Paciente" className="vc-cita-card--wide">
              <div className="vc-cita-paciente-row">
                <span className="vc-cita-paciente">
                  <span aria-hidden className="vc-cita-avatar">
                    {inicialNombre(cita.nombreCompleto)}
                  </span>
                  <span className="vc-cita-paciente__nombre">{cita.nombreCompleto}</span>
                </span>
                {fichaId ? (
                  <Link
                    to={`/expedientes/${fichaId}`}
                    onClick={onClose}
                    aria-label={`Ver expediente de ${cita.nombreCompleto}`}
                    title="Ver expediente"
                    className="vc-cita-iconbtn vc-cita-btn"
                  >
                    <Icon name="open_in_new" />
                  </Link>
                ) : null}
              </div>
              {cita.celular ? (
                <p className="vc-cita-celular">
                  <Icon name="smartphone" />
                  <span>
                    <span className="sr-only">Celular: </span>
                    {cita.celular}
                  </span>
                </p>
              ) : null}
            </Seccion>

            <Seccion titulo="Fecha y hora">
              <dl className="vc-cita-datos">
                <CampoDato etiqueta="Día" icono="calendar_month">
                  {fechaLargaCita(cita.programadaEn)}
                </CampoDato>
                <CampoDato etiqueta="Hora" icono="schedule">
                  {formatHora(cita.programadaEn)}
                </CampoDato>
                <CampoDato etiqueta="Área" icono="groups">
                  {areaNombre(cita.areaClave)}
                </CampoDato>
              </dl>
              {reagendadaA ? (
                <p className="vc-cita-nota vc-cita-nota--acento">
                  <Icon name="autorenew" />
                  <span>
                    Reagendada para {fechaLargaCita(reagendadaA)}, {formatHora(reagendadaA)}.
                  </span>
                </p>
              ) : null}
            </Seccion>

            <Seccion titulo="Datos generales">
              <div className="vc-cita-chips">
                <CitaEstadoChip estado={cita.estado} />
                <CitaPrioridadChip prioridad={cita.prioridad} vacio />
                <CitaUmecaBadge cita={cita} />
              </div>
              <dl className="vc-cita-datos">
                <Dato etiqueta="Origen">{ORIGEN_LABELS[cita.origen]}</Dato>
                <Dato etiqueta="Recomendada por">{cita.recomendadaPor?.trim() || 'No indicada'}</Dato>
                {cita.reagendadaDe ? (
                  <Dato etiqueta="Reagendada de">
                    {original ? (
                      <button type="button" onClick={() => onAbrirCita(original)} className="vc-cita-link vc-cita-btn">
                        <span>
                          Cita del {fechaLargaCita(original.programadaEn)}, {formatHora(original.programadaEn)}
                        </span>
                        <Icon name="open_in_new" />
                      </button>
                    ) : (
                      'Una cita anterior'
                    )}
                  </Dato>
                ) : null}
              </dl>
            </Seccion>

            {!hayAcciones ? (
              <p className="vc-cita-nota vc-cita-nota--wide">
                <Icon name="info" />
                <span>
                  {cita.estado === 'agendada' || cita.estado === 'confirmada'
                    ? 'Tu rol no puede modificar esta cita.'
                    : 'Esta cita ya no admite cambios de estado.'}
                </span>
              </p>
            ) : null}
            {error && modo === null ? (
              <p role="alert" className="vc-cita-error">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </Dialog.Body>

      {modo !== null ? (
        <Dialog.Footer>
          <button type="button" className="mk-button mk-button--text vc-cita-btn" disabled={pending} onClick={() => abrirModo(null)}>
            Volver
          </button>
          <button type="submit" form={formId} className="mk-button mk-button--filled vc-cita-btn" disabled={pending}>
            {modo === 'cancelar'
              ? pending
                ? 'Cancelando…'
                : 'Confirmar cancelación'
              : pending
                ? 'Reagendando…'
                : 'Reagendar cita'}
          </button>
        </Dialog.Footer>
      ) : primarias ? (
        <Dialog.Footer>
          {acciones.noAsistio ? (
            <button
              type="button"
              className="mk-button mk-button--tonal vc-cita-btn"
              disabled={pending}
              onClick={() => void cambiar('no_asistio', 'Inasistencia registrada en la cita.')}
            >
              No asistió
            </button>
          ) : null}
          {acciones.confirmar ? (
            <button
              type="button"
              className="mk-button mk-button--tonal vc-cita-btn"
              disabled={pending}
              onClick={() => void cambiar('confirmada', 'Cita confirmada.')}
            >
              Confirmar
            </button>
          ) : null}
          {acciones.asistio ? (
            <button type="button" className="mk-button mk-button--filled vc-cita-btn" disabled={pending} onClick={() => onAbrirSeguimiento(cita)}>
              Marcar asistió
            </button>
          ) : null}
          {acciones.agendarSiguiente ? (
            <button type="button" className="mk-button mk-button--filled vc-cita-btn inline-flex items-center gap-1.5" onClick={() => onAgendarSiguiente(cita)}>
              <Icon name="calendar_month" />
              <span>Agendar siguiente cita</span>
            </button>
          ) : null}
        </Dialog.Footer>
      ) : null}
    </>
  );
}
