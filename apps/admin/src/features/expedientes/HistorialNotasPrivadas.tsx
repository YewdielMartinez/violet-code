import { memo, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { EmptyState, LoadingButton, Skeleton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/skeleton';
import {
  NOTA_PRIVADA_MAX_LENGTH,
  ordenarNotasRecientes,
  puedeVerNotasPsicologia,
  validateNotaPrivada,
  type NotaPrivada,
} from '@/domain/models/NotaPrivada';
import { formatFechaHora } from '@/features/intervenciones/formatters';
import {
  traducirErrorIntervencion,
  useActualizarNotaPrivada,
  useArchivarNotaPrivada,
  useCrearNotaPrivada,
  useNotasPrivadas,
} from '@/features/intervenciones/api';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import './historial-clinico.css';
import './historial-notas.css';

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];
const LOADING_LABELS = { loading: 'Guardando…', success: 'Nota guardada', error: 'No se guardó' };

interface NoteTextareaProps {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

function NoteTextarea({ label, value, disabled, onChange, autoFocus = false }: NoteTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const nearLimit = value.length >= NOTA_PRIVADA_MAX_LENGTH - 1000;

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <label className="vc-hc-edit-field">
      <span className="vc-hc-edit-field__label">{label}</span>
      <textarea
        ref={ref}
        rows={4}
        maxLength={NOTA_PRIVADA_MAX_LENGTH}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Observaciones internas de Psicología (no aparecen en la línea de tiempo)"
        className="vc-hc-textarea"
      />
      {nearLimit ? (
        <span
          className="vc-hc-edit-field__count"
          data-warn={value.length >= NOTA_PRIVADA_MAX_LENGTH - 200 ? 'true' : undefined}
        >
          {value.length} / {NOTA_PRIVADA_MAX_LENGTH}
        </span>
      ) : null}
    </label>
  );
}

interface NotaItemProps {
  nota: NotaPrivada;
  fichaId: string;
  index: number;
}

/** Una nota con edición en línea y archivado lógico (sin borrado físico). */
function NotaItem({ nota, fichaId, index }: NotaItemProps) {
  const [editando, setEditando] = useState(false);
  const [confirmarArchivo, setConfirmarArchivo] = useState(false);
  const [borrador, setBorrador] = useState(nota.contenido);
  const actualizar = useActualizarNotaPrivada(fichaId);
  const archivar = useArchivarNotaPrivada(fichaId);
  const busy = actualizar.isPending || archivar.isPending;
  const editada = nota.actualizadoEn !== nota.creadoEn;

  async function guardar() {
    const error = validateNotaPrivada(borrador);
    if (error) {
      toast(error, { tone: 'error' });
      return;
    }
    try {
      await actualizar.mutateAsync({ id: nota.id, contenido: borrador });
      setEditando(false);
      toast('Nota actualizada.', { tone: 'success' });
    } catch (err) {
      toast(traducirErrorIntervencion(err, 'No se pudo actualizar la nota.'), { tone: 'error' });
    }
  }

  async function archivarNota() {
    try {
      await archivar.mutateAsync(nota.id);
      toast('Nota archivada.', { tone: 'success' });
    } catch (err) {
      setConfirmarArchivo(false);
      toast(traducirErrorIntervencion(err, 'No se pudo archivar la nota.'), { tone: 'error' });
    }
  }

  return (
    <li className="vc-hc-note" style={{ '--i': Math.min(index, 8) } as CSSProperties}>
      <div className="vc-hc-note__meta">
        <time dateTime={nota.creadoEn}>{formatFechaHora(nota.creadoEn)}</time>
        {editada ? <span>· editada {formatFechaHora(nota.actualizadoEn)}</span> : null}
      </div>

      {editando ? (
        <div className="vc-hc-note__edit">
          <NoteTextarea label="Editar nota" value={borrador} disabled={busy} onChange={setBorrador} autoFocus />
          <div className="vc-hc-form__footer">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditando(false)}
              className="mk-button mk-button--text"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void guardar()}
              className="mk-button mk-button--filled"
            >
              Guardar nota
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="vc-hc-note__text">{nota.contenido}</p>
          <div className="vc-hc-note__actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBorrador(nota.contenido);
                setConfirmarArchivo(false);
                setEditando(true);
              }}
              aria-label="Editar nota"
              className="mk-button mk-button--text mk-button--sm"
            >
              Editar
            </button>
            {confirmarArchivo ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void archivarNota()}
                  className="mk-button mk-button--text mk-button--sm vc-hc-note__danger"
                >
                  Confirmar archivo
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmarArchivo(false)}
                  className="mk-button mk-button--text mk-button--sm"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmarArchivo(true)}
                aria-label="Archivar nota"
                className="mk-button mk-button--text mk-button--sm"
              >
                Archivar
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}

export interface HistorialNotasPrivadasProps {
  fichaId: string;
}

/**
 * Notas privadas de Psicología dentro del Historial clínico (`RF-10`, `RN-09`).
 * Solo las ve y escribe el rol Psicología (RLS de `nota_area`, permiso `nota_psicologia.acceder`):
 * para cualquier otro rol este bloque no se renderiza.
 */
export const HistorialNotasPrivadas = memo(function HistorialNotasPrivadas({
  fichaId,
}: HistorialNotasPrivadasProps) {
  const { user } = useAuth();
  const puedeVer = puedeVerNotasPsicologia(user?.role);
  const puedeCrear = puedeVer && user?.areaId != null;

  const notasQuery = useNotasPrivadas(fichaId, puedeVer);
  const crear = useCrearNotaPrivada(fichaId);

  const [composing, setComposing] = useState(false);
  const [contenido, setContenido] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const wasComposingRef = useRef(false);

  // Al cerrar el formulario el foco vuelve al botón «Agregar nota».
  useEffect(() => {
    if (composing) {
      wasComposingRef.current = true;
      return;
    }
    if (!wasComposingRef.current) return;
    wasComposingRef.current = false;
    addButtonRef.current?.focus({ preventScroll: true });
  }, [composing]);

  if (!puedeVer) return null;

  const notas = ordenarNotasRecientes(notasQuery.data ?? []);

  function cerrarFormulario() {
    setComposing(false);
    setContenido('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (crear.isPending) return;
    const error = validateNotaPrivada(contenido);
    if (error) {
      toast(error, { tone: 'error' });
      return;
    }
    try {
      await crear.mutateAsync({ fichaId, areaId: user?.areaId as number, contenido });
      cerrarFormulario();
      toast('Nota privada guardada.', { tone: 'success' });
    } catch (err) {
      toast(traducirErrorIntervencion(err, 'No se pudo guardar la nota.'), { tone: 'error' });
    }
  }

  return (
    <section aria-label="Notas privadas" className="vc-hc-notes">
      <header className="vc-hc__head">
        <div className="vc-hc__head-text">
          <div className="vc-hc__title-wrap">
            <h4 className="vc-hc__title">Notas privadas</h4>
            {notas.length > 0 ? (
              <span className="vc-hc-vers__count">
                {notas.length === 1 ? '1 nota' : `${notas.length} notas`}
              </span>
            ) : null}
          </div>
          <p className="vc-hc-notes__lock">
            <Icon name="lock" className="vc-hc-notes__lock-icon" />
            Solo tú puedes verlas. Dirección y las demás áreas no tienen acceso.
          </p>
        </div>

        {puedeCrear ? (
          <button
            ref={addButtonRef}
            type="button"
            className="mk-button mk-button--text vc-hc__action"
            aria-hidden={composing ? true : undefined}
            tabIndex={composing ? -1 : undefined}
            disabled={composing}
            onClick={() => setComposing(true)}
          >
            Agregar nota
          </button>
        ) : null}
      </header>

      {composing ? (
        <form
          className="vc-hc-form vc-hc-notes__composer"
          aria-label="Nueva nota privada"
          onSubmit={(e) => void handleSubmit(e)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape' || e.defaultPrevented || crear.isPending) return;
            e.preventDefault();
            e.stopPropagation();
            cerrarFormulario();
          }}
        >
          <NoteTextarea
            label="Nueva nota"
            value={contenido}
            disabled={crear.isPending}
            onChange={setContenido}
            autoFocus
          />
          <div className="vc-hc-form__footer">
            <button
              type="button"
              disabled={crear.isPending}
              onClick={cerrarFormulario}
              className="mk-button mk-button--text"
            >
              Cancelar
            </button>
            <LoadingButton
              type="submit"
              state={crear.isPending ? 'loading' : 'idle'}
              labels={LOADING_LABELS}
              disabled={crear.isPending || !contenido.trim()}
              className="mk-button mk-button--filled"
            >
              Guardar nota
            </LoadingButton>
          </div>
        </form>
      ) : null}

      {notasQuery.isError ? (
        <EmptyState
          illustration="error"
          title="No se pudieron cargar las notas"
          actions={RETRY_ACTION}
          onAction={() => void notasQuery.refetch()}
        />
      ) : (
        <Skeleton loading={notasQuery.isLoading} shape="card" lines={3} label="Cargando notas privadas">
          {notas.length === 0 ? (
            composing ? null : (
              <p className="vc-hc-vers__empty">Aún no hay notas privadas en este expediente.</p>
            )
          ) : (
            <ul className="vc-hc-notes__list">
              {notas.map((nota, index) => (
                <NotaItem key={nota.id} nota={nota} fichaId={fichaId} index={index} />
              ))}
            </ul>
          )}
        </Skeleton>
      )}
    </section>
  );
});
