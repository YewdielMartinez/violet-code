import { useId, useRef, useState, type FormEvent } from 'react';
import { toast } from '@yewdiel21/motion-kit/react';
import { ROLE_LABELS } from '@/domain/models/Auth';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TonalCard } from '@/shared/ui/TonalCard';
import { PasswordField } from '@/features/auth/PasswordField';
import {
  DataSection,
  Dato,
  DatoGrid,
  FormInlineError,
  SectionFormFooter,
} from '@/features/expedientes/datos/DataSection';
import {
  errorMessage,
  useActualizarMiPerfil,
  useCambiarContrasena,
  validarCambioContrasena,
  validarMiPerfil,
  type MiPerfil,
} from './api';
import { agruparPermisos } from './permisos';
import './perfil.css';

const TONE_ACTIVO = 'bg-status-success-bg text-status-success';
const TONE_INACTIVO = 'bg-status-danger-bg text-status-danger';
const TONE_ROL = 'bg-secondary-container text-on-secondary-container';

/**
 * Bloques de la sección «Cuenta» de Configuración (resumen, contacto, datos de la cuenta, contraseña, permisos).
 * Se componen en `PerfilCuentaSection`. Una sola columna: viven en el cuerpo de un diálogo.
 */

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function formatTelefono(telefono: string | null): string | null {
  if (!telefono) return null;
  const digits = telefono.replace(/\D/g, '');
  return digits.length === 10 ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}` : telefono;
}

function focusField(root: HTMLElement | null, field: string) {
  root?.querySelector<HTMLElement>(`[data-perfil-field="${field}"] input, input[data-perfil-field="${field}"]`)?.focus();
}

function areaLabel(perfil: MiPerfil): { label: string; value: string } {
  if (perfil.tipo === 'externo') {
    return { label: 'Dependencia', value: perfil.dependencia === 'umeca' ? 'UMECA' : (perfil.dependencia ?? 'Externa') };
  }
  return { label: 'Área', value: perfil.areaNombre ?? 'Sin área asignada' };
}

export function PerfilHero({ perfil }: { perfil: MiPerfil }) {
  return (
    <section className="vc-perfil__hero" aria-label="Resumen de tu cuenta">
      <span className="vc-perfil__avatar" aria-hidden>
        {iniciales(perfil.nombre)}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="vc-perfil__name">{perfil.nombre}</h3>
        <p className="vc-perfil__email">{perfil.correo}</p>
        <div className="vc-chips mt-3">
          <StatusChip value={perfil.rol} tone={TONE_ROL}>
            {ROLE_LABELS[perfil.rol] ?? perfil.rol}
          </StatusChip>
          <StatusChip value={perfil.activo ? 'activo' : 'inactivo'} tone={perfil.activo ? TONE_ACTIVO : TONE_INACTIVO}>
            {perfil.activo ? 'Cuenta activa' : 'Cuenta inactiva'}
          </StatusChip>
        </div>
      </div>
    </section>
  );
}

export function ContactoSection({ perfil }: { perfil: MiPerfil }) {
  const actualizar = useActualizarMiPerfil();
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ nombre: perfil.nombre, telefono: perfil.telefono ?? '' });

  function startEditing() {
    setDraft({ nombre: perfil.nombre, telefono: perfil.telefono ?? '' });
    setSaved(false);
    setFormError(null);
    setEditing(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const failure = validarMiPerfil(draft);
    if (failure) {
      setFormError(failure.error);
      focusField(formRef.current, failure.field);
      return;
    }
    setFormError(null);
    try {
      await actualizar.mutateAsync(draft);
      setSaved(true);
      setEditing(false);
      setSavedTick((tick) => tick + 1);
      toast('Tu perfil se actualizó.', { tone: 'success' });
    } catch (err) {
      const message = errorMessage(err, 'No se pudo guardar tu perfil. Intenta de nuevo.');
      setFormError(message);
      toast(message, { tone: 'error' });
    }
  }

  const editForm = (
    <form ref={formRef} noValidate onSubmit={(e) => void handleSubmit(e)} className="vc-sec-form">
      <div className="grid gap-4">
        <label className="mk-field">
          <span className="mk-field__label">Nombre completo *</span>
          <input
            type="text"
            data-perfil-field="nombre"
            autoComplete="name"
            maxLength={120}
            value={draft.nombre}
            aria-invalid={formError && !draft.nombre.trim() ? true : undefined}
            onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
          />
        </label>
        <label className="mk-field">
          <span className="mk-field__label">Teléfono (10 dígitos)</span>
          <input
            type="tel"
            inputMode="numeric"
            data-perfil-field="telefono"
            autoComplete="tel-national"
            maxLength={10}
            placeholder="6680000000"
            value={draft.telefono}
            onChange={(e) => setDraft({ ...draft, telefono: e.target.value.replace(/\D/g, '').slice(0, 10) })}
          />
        </label>
      </div>

      <FormInlineError message={formError} />

      <SectionFormFooter
        pending={actualizar.isPending}
        saved={saved}
        onCancel={() => setEditing(false)}
        submitLabel="Guardar cambios"
      />
    </form>
  );

  return (
    <DataSection
      title="Datos de contacto"
      editLabel="datos de contacto"
      canEdit={perfil.activo}
      editing={editing}
      onStartEdit={startEditing}
      savedTick={savedTick}
      editForm={editForm}
    >
      <DatoGrid>
        <Dato label="Nombre completo" value={perfil.nombre} />
        <Dato label="Teléfono" value={formatTelefono(perfil.telefono)} mono />
      </DatoGrid>
    </DataSection>
  );
}

export function CuentaInfoSection({ perfil }: { perfil: MiPerfil }) {
  const area = areaLabel(perfil);
  return (
    <DataSection title="Datos de la cuenta" canEdit={false} editing={false} onStartEdit={() => {}} editForm={null}>
      <DatoGrid>
        <Dato label="Correo electrónico" value={perfil.correo} fullWidth />
        <Dato label="Rol" value={ROLE_LABELS[perfil.rol] ?? perfil.rol} />
        <Dato label={area.label} value={area.value} />
        <Dato label="Estado de la cuenta">
          <p className="vc-dato__value">
            <StatusChip value={perfil.activo ? 'activo' : 'inactivo'} tone={perfil.activo ? TONE_ACTIVO : TONE_INACTIVO}>
              {perfil.activo ? 'Activa' : 'Inactiva'}
            </StatusChip>
          </p>
        </Dato>
      </DatoGrid>
    </DataSection>
  );
}

export function ContrasenaSection({ perfil }: { perfil: MiPerfil }) {
  const cambiar = useCambiarContrasena();
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [formError, setFormError] = useState<{ field: string | null; message: string } | null>(null);
  const [draft, setDraft] = useState({ actual: '', nueva: '', confirmar: '' });

  function startEditing() {
    setDraft({ actual: '', nueva: '', confirmar: '' });
    setSaved(false);
    setFormError(null);
    setEditing(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const failure = validarCambioContrasena(draft);
    if (failure) {
      setFormError({ field: failure.field, message: failure.error });
      focusField(formRef.current, failure.field);
      return;
    }
    setFormError(null);
    try {
      await cambiar.mutateAsync({ actual: draft.actual, nueva: draft.nueva });
      setSaved(true);
      setEditing(false);
      setSavedTick((tick) => tick + 1);
      setDraft({ actual: '', nueva: '', confirmar: '' });
      toast('Tu contraseña se actualizó.', { tone: 'success' });
    } catch (err) {
      const message = errorMessage(err, 'No se pudo cambiar la contraseña. Intenta de nuevo.');
      setFormError({ field: null, message });
      toast(message, { tone: 'error' });
    }
  }

  const invalid = (field: string) => formError?.field === field;

  const editForm = (
    <form ref={formRef} noValidate onSubmit={(e) => void handleSubmit(e)} className="vc-sec-form">
      <div className="grid gap-4">
        <div>
          <PasswordField
            label="Contraseña actual"
            name="current-password"
            autoComplete="current-password"
            value={draft.actual}
            onChange={(actual) => setDraft({ ...draft, actual })}
            invalid={invalid('actual')}
            dataAttrs={{ 'data-perfil-field': 'actual' }}
          />
        </div>
        <PasswordField
          label="Nueva contraseña"
          name="new-password"
          autoComplete="new-password"
          value={draft.nueva}
          onChange={(nueva) => setDraft({ ...draft, nueva })}
          invalid={invalid('nueva')}
          dataAttrs={{ 'data-perfil-field': 'nueva' }}
        />
        <PasswordField
          label="Confirmar nueva contraseña"
          name="confirm-password"
          autoComplete="new-password"
          value={draft.confirmar}
          onChange={(confirmar) => setDraft({ ...draft, confirmar })}
          invalid={invalid('confirmar')}
          dataAttrs={{ 'data-perfil-field': 'confirmar' }}
        />
      </div>
      <p className="vc-perfil__hint">Mínimo 8 caracteres, con letras y números.</p>

      <FormInlineError message={formError?.message ?? null} />

      <SectionFormFooter
        pending={cambiar.isPending}
        saved={saved}
        onCancel={() => setEditing(false)}
        submitLabel="Guardar contraseña"
      />
    </form>
  );

  return (
    <DataSection
      title="Contraseña"
      editLabel="contraseña"
      editText="Cambiar"
      canEdit={perfil.activo}
      editing={editing}
      onStartEdit={startEditing}
      savedTick={savedTick}
      editForm={editForm}
    >
      <DatoGrid>
        <Dato label="Contraseña" value="••••••••" mono />
        <Dato label="Seguridad">
          <p className="vc-dato__value">Para cambiarla necesitas escribir primero tu contraseña actual.</p>
        </Dato>
      </DatoGrid>
    </DataSection>
  );
}

export function PermisosCard({ perfil }: { perfil: MiPerfil }) {
  const grupos = agruparPermisos(perfil.permisos);
  const total = perfil.permisos.length;
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <TonalCard title="Permisos" wide>
      {grupos.length === 0 ? (
        <p className="vc-perfil__hint">
          Tu cuenta no tiene permisos operativos en el panel: solo puedes consultar la información de tu dependencia.
        </p>
      ) : (
        <>
          <div className="vc-perfil__perm-head">
            <p className="vc-perfil__hint">
              {total === 1 ? '1 permiso activo en tu cuenta.' : `${total} permisos activos en tu cuenta.`}
            </p>
            <button
              type="button"
              className="mk-button mk-button--tonal mk-button--sm"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Ocultar permisos' : 'Ver permisos'}
            </button>
          </div>
          <div
            id={panelId}
            className="vc-perfil__collapse"
            data-open={open ? 'true' : 'false'}
            aria-hidden={open ? undefined : true}
            inert={open ? undefined : true}
          >
            <div className="vc-perfil__collapse-inner">
              <div className="vc-perfil__groups">
                {grupos.map((grupo) => (
                  <div key={grupo.prefijo} role="group" aria-label={grupo.titulo}>
                    <h4 className="vc-perfil__group-title">{grupo.titulo}</h4>
                    <div className="vc-chips">
                      {grupo.permisos.map((permiso) => (
                        <span
                          key={permiso.clave}
                          className="vc-chip bg-surface-container-highest text-on-surface"
                          title={permiso.clave}
                        >
                          {permiso.etiqueta}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </TonalCard>
  );
}
