import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LoadingButton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/loading-button';
import { Icon } from '@/shared/ui/Icon';
import './datos.css';

/** Debe coincidir con `--vc-sec-duration` en `datos.css`. */
const TRANSITION_MS = 320;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface Presence {
  /** El formulario está en el DOM (también durante la animación de salida). */
  mounted: boolean;
  /** El panel está abierto: dispara la transición de `grid-template-rows` y opacidad. */
  expanded: boolean;
  /** Terminó de abrir: se libera `overflow` para no recortar anillos de foco ni menús. */
  settled: boolean;
}

/**
 * Fases de presencia del formulario de edición: monta, expande en el siguiente frame (para que la
 * transición parta de 0fr), «asienta»; al salir colapsa y desmonta al terminar la animación.
 * Con `prefers-reduced-motion` salta directo al estado final.
 */
function useEditPresence(active: boolean): Presence {
  const [state, setState] = useState<Presence>({
    mounted: active,
    expanded: active,
    settled: active,
  });

  useEffect(() => {
    const apply = (patch: Partial<Presence>) =>
      setState((prev) => {
        const next = { ...prev, ...patch };
        return next.mounted === prev.mounted &&
          next.expanded === prev.expanded &&
          next.settled === prev.settled
          ? prev
          : next;
      });

    if (prefersReducedMotion()) {
      apply({ mounted: active, expanded: active, settled: active });
      return;
    }

    if (active) {
      apply({ mounted: true });
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => apply({ expanded: true }));
      });
      const timer = window.setTimeout(() => apply({ settled: true }), TRANSITION_MS + 40);
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
        window.clearTimeout(timer);
      };
    }

    apply({ expanded: false, settled: false });
    const timer = window.setTimeout(() => apply({ mounted: false }), TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  return state;
}

const FIRST_FIELD_SELECTOR =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]:not([disabled])';

interface DataSectionProps {
  /** Título de la sección (18 px, semibold). */
  title: string;
  /** Complemento para el nombre accesible del botón (ej. «domicilio» da «Editar domicilio»). */
  editLabel?: string;
  canEdit: boolean;
  editing: boolean;
  onStartEdit: () => void;
  /** Se incrementa en cada guardado exitoso: dispara la palomita «Guardado» en el encabezado. */
  savedTick?: number;
  /** Formulario de edición; solo se monta mientras se edita (y durante la animación de salida). */
  editForm: ReactNode;
  /** Vista de solo lectura. */
  children: ReactNode;
}

/**
 * Sección de datos con alternancia vista y edición animada: ambas se intercambian con colapso
 * de altura (`grid-rows`), desvanecido y desplazamiento corto. Al abrir enfoca el primer campo;
 * al cerrar devuelve el foco al botón «Editar».
 */
export function DataSection({
  title,
  editLabel,
  canEdit,
  editing,
  onStartEdit,
  savedTick = 0,
  editForm,
  children,
}: DataSectionProps) {
  const { mounted, expanded, settled } = useEditPresence(editing);
  const editPaneRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditingRef = useRef(false);

  // Foco al primer campo cuando el formulario ya es visible.
  useEffect(() => {
    if (!editing || !expanded) return;
    editPaneRef.current?.querySelector<HTMLElement>(FIRST_FIELD_SELECTOR)?.focus({ preventScroll: true });
  }, [editing, expanded]);

  // Al cerrar (cancelar o guardar) el foco vuelve al botón «Editar» si seguía dentro del formulario.
  useEffect(() => {
    if (editing) {
      wasEditingRef.current = true;
      return;
    }
    if (!wasEditingRef.current) return;
    wasEditingRef.current = false;
    const active = document.activeElement;
    const focusLost =
      !active || active === document.body || Boolean(editPaneRef.current?.contains(active));
    if (focusLost) editButtonRef.current?.focus({ preventScroll: true });
  }, [editing]);

  return (
    <section aria-label={title} className="vc-sec" data-editing={editing ? 'true' : 'false'}>
      <header className="vc-sec__head">
        <div className="vc-sec__title-wrap">
          <h4 className="vc-sec__title">{title}</h4>
          <span role="status" className="vc-sec__status">
            {savedTick > 0 ? (
              <span key={savedTick} className="vc-sec__saved">
                <span className="vc-sec__saved-badge" aria-hidden>
                  <Icon name="check" className="vc-sec__saved-icon" />
                </span>
                <span>Guardado</span>
              </span>
            ) : null}
          </span>
        </div>

        {canEdit ? (
          <button
            ref={editButtonRef}
            type="button"
            className="mk-button mk-button--tonal mk-button--sm vc-sec__edit"
            aria-label={editLabel ? `Editar ${editLabel}` : undefined}
            aria-hidden={editing ? true : undefined}
            tabIndex={editing ? -1 : undefined}
            disabled={editing}
            onClick={onStartEdit}
          >
            Editar
          </button>
        ) : null}
      </header>

      <div className="vc-sec__body">
        <div
          className="vc-sec__pane vc-sec__pane--view"
          data-open={editing ? 'false' : 'true'}
          aria-hidden={editing ? true : undefined}
          inert={editing ? true : undefined}
        >
          <div className="vc-sec__pane-inner">{children}</div>
        </div>

        {mounted ? (
          <div
            className="vc-sec__pane vc-sec__pane--edit"
            data-open={expanded ? 'true' : 'false'}
            data-settled={settled ? 'true' : 'false'}
            inert={editing ? undefined : true}
          >
            <div ref={editPaneRef} className="vc-sec__pane-inner">
              {editForm}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface DatoProps {
  label: string;
  value?: string | null;
  mono?: boolean;
  /** Ocupa las dos columnas en escritorio. */
  fullWidth?: boolean;
  /** Contenido propio (reemplaza al valor de texto, p. ej. una lista). */
  children?: ReactNode;
  /** Acciones al final de la tarjeta (p. ej. copiar). */
  action?: ReactNode;
}

/**
 * Tarjeta de dato: etiqueta 14 px atenuada + valor 16 px. Si el valor cambia tras montar
 * (guardado, refetch), un velo tonal parpadea una vez para señalar qué cambió.
 */
export function Dato({ label, value, mono = false, fullWidth = false, children, action }: DatoProps) {
  const clean = value?.trim() || null;
  const [seen, setSeen] = useState(clean);
  const [flashKey, setFlashKey] = useState(0);
  if (seen !== clean) {
    setSeen(clean);
    setFlashKey((k) => k + 1);
  }

  return (
    <div className="vc-dato" data-full={fullWidth ? 'true' : undefined}>
      {flashKey > 0 ? <span key={flashKey} aria-hidden className="vc-dato__flash" /> : null}
      <div className="vc-dato__main">
        <p className="vc-dato__label">{label}</p>
        {children ??
          (clean ? (
            <p className="vc-dato__value" data-mono={mono ? 'true' : undefined}>
              {clean}
            </p>
          ) : (
            <p className="vc-dato__value vc-dato__value--empty">Sin registrar</p>
          ))}
      </div>
      {action ? <div className="vc-dato__action">{action}</div> : null}
    </div>
  );
}

/** Rejilla de datos: 2 columnas en escritorio, 1 en móvil. */
export function DatoGrid({ children }: { children: ReactNode }) {
  return <div className="vc-dato-grid">{children}</div>;
}

/** Mensaje de error en línea del formulario (acompaña al toast); aparece con fade y leve desplazamiento. */
export function FormInlineError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="vc-form-error">
      {message}
    </p>
  ) : null;
}

const SAVE_LABELS = { loading: 'Guardando…', success: 'Guardado', error: 'Error al guardar' };

interface SectionFormFooterProps {
  pending: boolean;
  /** Guardado correcto: el botón pasa a «Guardado» mientras el formulario colapsa. */
  saved: boolean;
  onCancel: () => void;
  submitLabel: string;
}

/** Pie común de los formularios de sección: Cancelar (texto) + Guardar (relleno, con carga y éxito). */
export function SectionFormFooter({ pending, saved, onCancel, submitLabel }: SectionFormFooterProps) {
  return (
    <div className="vc-sec-form__footer">
      <button
        type="button"
        disabled={pending || saved}
        onClick={onCancel}
        className="mk-button mk-button--text"
      >
        Cancelar
      </button>
      <LoadingButton
        type="submit"
        state={pending ? 'loading' : saved ? 'success' : 'idle'}
        labels={SAVE_LABELS}
        disabled={pending || saved}
        className="mk-button mk-button--filled"
      >
        {submitLabel}
      </LoadingButton>
    </div>
  );
}

/** Texto en línea para un error de guardado (el toast lo emite `handleExpedienteMutationError`). */
export function describeMutationError(err: unknown, fallback: string): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code?: unknown }).code
      : undefined;
  if (code === '23505') {
    return 'Este registro fue modificado por otra persona. Se recargaron los datos: revísalos y vuelve a guardar.';
  }
  return err instanceof Error && err.message.trim() ? err.message : fallback;
}
