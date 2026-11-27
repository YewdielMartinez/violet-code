import { useEffect, useMemo, useRef, useState } from 'react';
import { GlassSwitch, MultiSelect, Select, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/glass-switch';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/multi-select';
import '@yewdiel21/motion-kit/css/components/select';
import { PrivacyNoticeDialog } from '@/features/auth/PrivacyNoticeDialog';
import {
  ESCOLARIDAD_LABELS,
  ESTADO_CIVIL_LABELS,
  SERVICIO_MEDICO_LABELS,
  type CatalogosFicha,
  type EscolaridadNivel,
  type EstadoCivil,
  type FichaIdentidadInput,
  type ServicioMedico,
} from '@/domain/models/FichaRegistro';
import {
  ESTADO_FICHA_LABELS,
  isValidCurp,
  normalizeCurp,
  type ExpedienteResumen,
  type PersonaResumen,
} from '@/domain/models/Persona';
import { canLookupPreRegistro, type PreRegistroMovil } from '@/domain/models/PreRegistroMovil';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { useVerifyCurp } from '../api';
import { BannerPrecargaMovil } from '../BannerPrecargaMovil';

interface Props {
  value: FichaIdentidadInput;
  onChange: (next: FichaIdentidadInput) => void;
  catalogos?: CatalogosFicha;
  invalidField?: string | null;
  allowPreRegistroLookup?: boolean;
  onOpenExpediente?: (expediente: ExpedienteResumen) => void;
  onDuplicateExpedienteChange?: (expediente: ExpedienteResumen | null) => void;
}

type CurpLookupState =
  | { status: 'idle' }
  | { status: 'loading'; curp: string }
  | { status: 'duplicate'; curp: string; expediente: ExpedienteResumen }
  | { status: 'persona_sin_ficha'; curp: string; persona: PersonaResumen }
  | { status: 'pre_registro'; curp: string; preRegistro: PreRegistroMovil; applied: boolean }
  | { status: 'available'; curp: string }
  | { status: 'error'; curp: string };

const ESTADO_CIVIL_OPTIONS = Object.entries(ESTADO_CIVIL_LABELS).map(([value, label]) => ({ value, label }));
const ESCOLARIDAD_OPTIONS = Object.entries(ESCOLARIDAD_LABELS).map(([value, label]) => ({ value, label }));
const SERVICIO_MEDICO_OPTIONS = Object.entries(SERVICIO_MEDICO_LABELS).map(([value, label]) => ({ value, label }));

const IDENTITY_FLAGS: { key: 'tieneTrabajo' | 'tieneEmbarazo' | 'tieneDenuncia' | 'esVictimaDelito'; label: string }[] = [
  { key: 'tieneTrabajo', label: 'Cuenta con trabajo remunerado' },
  { key: 'tieneEmbarazo', label: 'Embarazo actual' },
  { key: 'tieneDenuncia', label: 'Cuenta con denuncia previa' },
  { key: 'esVictimaDelito', label: 'Víctima de delito' },
];

const ENTIDAD_LABELS: Record<string, string> = {
  AS: 'Aguascalientes',
  BC: 'Baja California',
  BS: 'Baja California Sur',
  CC: 'Campeche',
  CL: 'Coahuila',
  CM: 'Colima',
  CS: 'Chiapas',
  CH: 'Chihuahua',
  DF: 'Ciudad de México',
  DG: 'Durango',
  GT: 'Guanajuato',
  GR: 'Guerrero',
  HG: 'Hidalgo',
  JC: 'Jalisco',
  MC: 'Estado de México',
  MN: 'Michoacán',
  MS: 'Morelos',
  NT: 'Nayarit',
  NL: 'Nuevo León',
  OC: 'Oaxaca',
  PL: 'Puebla',
  QT: 'Querétaro',
  QR: 'Quintana Roo',
  SP: 'San Luis Potosí',
  SL: 'Sinaloa',
  SR: 'Sonora',
  TC: 'Tabasco',
  TS: 'Tamaulipas',
  TL: 'Tlaxcala',
  VZ: 'Veracruz',
  YN: 'Yucatán',
  ZS: 'Zacatecas',
  NE: 'Nacido en el extranjero',
};

function derivePersonaFromCurp(curp: string): {
  fechaNacimiento: string;
  sexo: 'M' | 'H';
  entidadNacimiento: string;
} | null {
  const clean = normalizeCurp(curp);
  if (!isValidCurp(clean)) return null;
  const yy = Number(clean.slice(4, 6));
  const mm = clean.slice(6, 8);
  const dd = clean.slice(8, 10);
  const century = /[0-9]/.test(clean[16]) ? 1900 : 2000;
  return {
    fechaNacimiento: `${century + yy}-${mm}-${dd}`,
    sexo: clean[10] === 'H' ? 'H' : 'M',
    entidadNacimiento: clean.slice(11, 13),
  };
}

/** Paso 1 de la Ficha Única: verificación inline de CURP, identidad, servicios y Aviso de Privacidad (`RF-04`, `RF-34`, `RN-02`, `RNF-04`). */
export function FichaIdentidadStep({
  value,
  onChange,
  catalogos,
  invalidField,
  allowPreRegistroLookup,
  onOpenExpediente,
  onDuplicateExpedienteChange,
}: Props) {
  const { user } = useAuth();
  const verifyMutation = useVerifyCurp();

  const [lookup, setLookup] = useState<CurpLookupState>({ status: 'idle' });
  const [verifyAttempt, setVerifyAttempt] = useState(0);

  const normalizedCurp = normalizeCurp(value.curp);
  const curpComplete = normalizedCurp.length === 18;
  const curpValid = curpComplete && isValidCurp(normalizedCurp);

  const canLookupPre = allowPreRegistroLookup ?? (user ? canLookupPreRegistro(user.role) : false);
  const isRestrictedRole = user !== null && !canLookupPreRegistro(user.role);

  const latestValueRef = useRef(value);
  const latestCurpRef = useRef(normalizedCurp);
  const onChangeRef = useRef(onChange);
  const onDuplicateRef = useRef(onDuplicateExpedienteChange);
  const mutateAsyncRef = useRef(verifyMutation.mutateAsync);

  useEffect(() => {
    latestValueRef.current = value;
    latestCurpRef.current = normalizedCurp;
    onChangeRef.current = onChange;
    onDuplicateRef.current = onDuplicateExpedienteChange;
    mutateAsyncRef.current = verifyMutation.mutateAsync;
  });

  const areaOptions = useMemo(
    () => (catalogos?.areas ?? []).map((a) => ({ value: String(a.id), label: a.nombre })),
    [catalogos?.areas],
  );
  const ocupacionOptions = useMemo(
    () => (catalogos?.ocupaciones ?? []).map((o) => ({ value: String(o.id), label: o.nombre })),
    [catalogos?.ocupaciones],
  );

  useEffect(() => {
    if (!curpValid) return;

    let cancelled = false;
    const targetCurp = normalizedCurp;

    const timer = window.setTimeout(() => {
      setLookup({ status: 'loading', curp: targetCurp });

      void mutateAsyncRef
        .current({ curp: targetCurp, allowPreRegistroLookup: canLookupPre })
        .then((outcome) => {
          if (cancelled || latestCurpRef.current !== targetCurp) return;
          if (!outcome) {
            setLookup({ status: 'idle' });
            onDuplicateRef.current?.(null);
            return;
          }

          if (outcome.kind === 'expediente_existente') {
            setLookup({ status: 'duplicate', curp: targetCurp, expediente: outcome.expediente });
            onDuplicateRef.current?.(outcome.expediente);
            toast('Esta persona ya cuenta con un expediente registrado.', { tone: 'error' });
            if (latestValueRef.current.existingPersonaId) {
              onChangeRef.current({ ...latestValueRef.current, existingPersonaId: null });
            }
            return;
          }

          onDuplicateRef.current?.(null);

          if (outcome.kind === 'persona_sin_ficha') {
            if (isRestrictedRole) {
              setLookup({ status: 'available', curp: targetCurp });
              toast('CURP verificada y disponible para registro.', { tone: 'success' });
              return;
            }
            const p = outcome.persona;
            setLookup({ status: 'persona_sin_ficha', curp: targetCurp, persona: p });
            toast('Persona encontrada en padrón. Datos precargados.', { tone: 'info' });
            const cur = latestValueRef.current;
            onChangeRef.current({
              ...cur,
              curp: targetCurp,
              existingPersonaId: p.id,
              nombres: cur.nombres.trim() ? cur.nombres : p.nombres,
              apellidoPaterno: cur.apellidoPaterno.trim() ? cur.apellidoPaterno : p.apellidoPaterno,
              apellidoMaterno: cur.apellidoMaterno.trim() ? cur.apellidoMaterno : (p.apellidoMaterno ?? ''),
              celular: cur.celular.trim() ? cur.celular : (p.celular ?? ''),
            });
            return;
          }

          if (outcome.kind === 'pre_registro_movil') {
            if (isRestrictedRole || !canLookupPre) {
              setLookup({ status: 'available', curp: targetCurp });
              toast('CURP verificada y disponible para registro.', { tone: 'success' });
              return;
            }
            setLookup({
              status: 'pre_registro',
              curp: targetCurp,
              preRegistro: outcome.preRegistro,
              applied: false,
            });
            toast('Pre-registro móvil encontrado para esta persona.', { tone: 'info' });
            return;
          }

          setLookup({ status: 'available', curp: targetCurp });
          toast('CURP verificada y disponible para registro.', { tone: 'success' });
        })
        .catch(() => {
          if (cancelled || latestCurpRef.current !== targetCurp) return;
          onDuplicateRef.current?.(null);
          setLookup({ status: 'error', curp: targetCurp });
          toast('No se pudo verificar la CURP en este momento.', { tone: 'error' });
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [normalizedCurp, curpValid, canLookupPre, isRestrictedRole, verifyAttempt]);

  function update<K extends keyof FichaIdentidadInput>(key: K, fieldVal: FichaIdentidadInput[K]) {
    onChange({ ...value, [key]: fieldVal });
  }

  function handleCurpChange(raw: string) {
    const nextCurp = normalizeCurp(raw);
    const curpChanged = nextCurp !== normalizedCurp;
    if (curpChanged) {
      setLookup({ status: 'idle' });
      onDuplicateExpedienteChange?.(null);
    }
    onChange({
      ...value,
      curp: nextCurp,
      existingPersonaId: curpChanged ? null : value.existingPersonaId,
    });
  }

  function handleApplyPreRegistro(pre: PreRegistroMovil) {
    onChange({
      ...value,
      curp: pre.curp,
      existingPersonaId: pre.personaId,
      nombres: pre.nombres,
      apellidoPaterno: pre.apellidoPaterno,
      apellidoMaterno: pre.apellidoMaterno ?? '',
      celular: pre.celular ?? value.celular,
    });
    setLookup({ status: 'pre_registro', curp: pre.curp, preRegistro: pre, applied: true });
  }

  const derivedIdentity = useMemo(() => {
    if (lookup.status === 'pre_registro' && lookup.applied) {
      return {
        fechaNacimiento: lookup.preRegistro.fechaNacimiento,
        sexo: lookup.preRegistro.sexo,
        entidadNacimiento: lookup.preRegistro.entidadNacimiento,
      };
    }
    if (lookup.status === 'persona_sin_ficha') {
      return {
        fechaNacimiento: lookup.persona.fechaNacimiento,
        sexo: lookup.persona.sexo,
        entidadNacimiento: lookup.persona.entidadNacimiento,
      };
    }
    return derivePersonaFromCurp(normalizedCurp);
  }, [lookup, normalizedCurp]);

  const curpInvalid = invalidField === 'curp' || (curpComplete && !curpValid) || lookup.status === 'duplicate';

  return (
    <div className="vc-ficha-form grid gap-6">
      <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-semibold text-on-surface">Identificación oficial</h4>
            <p className="text-sm text-on-surface-variant">
              Al capturar los 18 caracteres se verifica automáticamente si la persona tiene registro previo.
            </p>
          </div>
          {normalizedCurp.length > 0 || lookup.status === 'available' ? (
            <div className="flex flex-wrap items-center gap-2">
              {lookup.status === 'available' ? (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 rounded-full bg-status-success-bg px-3 py-1 text-xs font-medium text-status-success"
                >
                  <Icon name="verified_user" className="text-[16px]" />
                  <span>CURP verificada</span>
                </span>
              ) : null}
              {normalizedCurp.length > 0 ? (
                <span
                  className={`rounded-full px-3 py-1 font-mono text-xs font-medium ${
                    curpValid
                      ? 'bg-status-success-bg text-status-success'
                      : curpComplete
                        ? 'bg-status-danger-bg text-status-danger'
                        : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {normalizedCurp.length}/18 {curpValid ? '· Formato válido' : curpComplete ? '· Formato inválido' : ''}
                </span>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="mk-field">
            <span className="mk-field__label">CURP *</span>
            <input
              type="text"
              maxLength={18}
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="Ej. GALA900512MSLNRR01"
              data-ficha-field="curp"
              aria-invalid={curpInvalid || undefined}
              className="font-mono tracking-wider uppercase"
              value={value.curp}
              onChange={(e) => handleCurpChange(e.target.value)}
            />
          </label>
          <label className="mk-field">
            <span className="mk-field__label">Teléfono celular (10 dígitos)</span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="6680000000"
              data-ficha-field="celular"
              aria-invalid={invalidField === 'celular' || undefined}
              value={value.celular}
              onChange={(e) => update('celular', e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </label>
        </div>

        {curpComplete && !curpValid ? (
          <p role="status" className="text-sm text-status-danger">
            La CURP debe cumplir con el formato oficial de 18 caracteres.
          </p>
        ) : null}

        {lookup.status === 'loading' ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2.5 rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant"
          >
            <span aria-hidden className="vc-ficha-spinner" />
            <span>Verificando CURP en el padrón…</span>
          </div>
        ) : null}

        {lookup.status === 'duplicate' ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4"
          >
            <div className="flex items-start gap-3">
              <Icon name="warning" className="mt-0.5 text-status-warning" />
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  Esta persona ya tiene expediente {lookup.expediente.folio}
                </p>
                {!isRestrictedRole ? (
                  <p className="mt-0.5 text-sm text-on-surface-variant">
                    {lookup.expediente.persona.nombreCompleto} ·{' '}
                    {ESTADO_FICHA_LABELS[lookup.expediente.estado]}. Abre su expediente existente para evitar duplicados.
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-on-surface-variant">
                    No es posible registrar un expediente duplicado para la misma persona.
                  </p>
                )}
              </div>
            </div>

            {!isRestrictedRole && lookup.expediente.id && onOpenExpediente ? (
              <button
                type="button"
                className="mk-button mk-button--primary"
                onClick={() => onOpenExpediente(lookup.expediente)}
              >
                <Icon name="folder_open" />
                <span>Abrir expediente</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {lookup.status === 'persona_sin_ficha' ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface"
          >
            <Icon name="person_check" className="mt-0.5 text-status-info" />
            <div>
              <p className="font-semibold">Persona registrada en padrón sin Ficha Única activa</p>
              <p className="mt-0.5 text-on-surface-variant">
                Se reutilizará el registro de <strong>{lookup.persona.nombreCompleto}</strong> y se precargaron sus datos disponibles.
              </p>
            </div>
          </div>
        ) : null}

        {lookup.status === 'pre_registro' ? (
          <BannerPrecargaMovil
            preRegistro={lookup.preRegistro}
            confirmed={lookup.applied}
            onConfirm={handleApplyPreRegistro}
            onDismiss={() => setLookup({ status: 'available', curp: lookup.curp })}
          />
        ) : null}

        {lookup.status === 'error' ? (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface-variant"
          >
            <span>No se pudo verificar la CURP en este momento. Puedes continuar o reintentar.</span>
            <button
              type="button"
              className="mk-button mk-button--text mk-button--sm"
              onClick={() => setVerifyAttempt((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {derivedIdentity ? (
          <dl className="grid gap-3 rounded-xl bg-surface-container-low p-3.5 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-on-surface-variant">Fecha de nacimiento</dt>
              <dd className="mt-0.5 font-mono font-medium text-on-surface">
                {derivedIdentity.fechaNacimiento || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-on-surface-variant">Sexo</dt>
              <dd className="mt-0.5 font-medium text-on-surface">
                {derivedIdentity.sexo === 'H' ? 'Masculino' : 'Femenino'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-on-surface-variant">Entidad de nacimiento</dt>
              <dd className="mt-0.5 font-medium text-on-surface">
                {ENTIDAD_LABELS[derivedIdentity.entidadNacimiento]
                  ? `${ENTIDAD_LABELS[derivedIdentity.entidadNacimiento]} (${derivedIdentity.entidadNacimiento})`
                  : derivedIdentity.entidadNacimiento}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <h4 className="text-base font-semibold text-on-surface">Nombre completo</h4>

        <label className="mk-field">
          <span className="mk-field__label">Nombre(s) *</span>
          <input
            type="text"
            required
            maxLength={100}
            placeholder="Nombre(s) de la usuaria"
            data-ficha-field="nombres"
            aria-invalid={invalidField === 'nombres' || undefined}
            value={value.nombres}
            onChange={(e) => update('nombres', e.target.value)}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="mk-field">
            <span className="mk-field__label">Apellido paterno *</span>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="Primer apellido"
              data-ficha-field="apellidoPaterno"
              aria-invalid={invalidField === 'apellidoPaterno' || undefined}
              value={value.apellidoPaterno}
              onChange={(e) => update('apellidoPaterno', e.target.value)}
            />
          </label>
          <label className="mk-field">
            <span className="mk-field__label">Apellido materno</span>
            <input
              type="text"
              maxLength={100}
              placeholder="Segundo apellido"
              value={value.apellidoMaterno}
              onChange={(e) => update('apellidoMaterno', e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <h4 className="text-base font-semibold text-on-surface">Perfil sociodemográfico</h4>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <span className="vc-ficha-label">Estado civil</span>
            <Select
              size="lg"
              label="Estado civil"
              placeholder="Selecciona…"
              options={ESTADO_CIVIL_OPTIONS}
              value={value.estadoCivil}
              onChange={(v) => update('estadoCivil', v as EstadoCivil)}
            />
          </div>
          <div className="grid gap-2">
            <span className="vc-ficha-label">Escolaridad</span>
            <Select
              size="lg"
              label="Escolaridad"
              placeholder="Selecciona…"
              options={ESCOLARIDAD_OPTIONS}
              value={value.escolaridad}
              onChange={(v) => update('escolaridad', v as EscolaridadNivel)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <span className="vc-ficha-label">Ocupación</span>
            <Select
              size="lg"
              label="Ocupación"
              placeholder="Selecciona…"
              options={ocupacionOptions}
              value={value.ocupacionId ? String(value.ocupacionId) : ''}
              onChange={(v) => update('ocupacionId', v ? Number(v) : null)}
            />
          </div>
          <div className="grid gap-2">
            <span className="vc-ficha-label">Servicio médico</span>
            <Select
              size="lg"
              label="Servicio médico"
              options={SERVICIO_MEDICO_OPTIONS}
              value={value.servicioMedico}
              onChange={(v) => update('servicioMedico', v as ServicioMedico)}
            />
          </div>
        </div>

        {value.servicioMedico === 'otro' ? (
          <label className="mk-field">
            <span className="mk-field__label">Especificar servicio médico *</span>
            <input
              type="text"
              maxLength={100}
              data-ficha-field="servicioMedicoOtro"
              aria-invalid={invalidField === 'servicioMedicoOtro' || undefined}
              value={value.servicioMedicoOtro}
              onChange={(e) => update('servicioMedicoOtro', e.target.value)}
            />
          </label>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="mk-field">
            <span className="mk-field__label">Número de hijas</span>
            <input
              type="number"
              min={0}
              max={30}
              value={value.numeroHijas}
              onChange={(e) => update('numeroHijas', e.target.value)}
            />
          </label>
          <label className="mk-field">
            <span className="mk-field__label">Número de hijos</span>
            <input
              type="number"
              min={0}
              max={30}
              value={value.numeroHijosHombres}
              onChange={(e) => update('numeroHijosHombres', e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <h4 className="text-base font-semibold text-on-surface">Servicios solicitados y situación actual</h4>

        <div
          className="grid gap-2"
          data-ficha-field="serviciosSolicitadosAreaIds"
          data-ficha-invalid={invalidField === 'serviciosSolicitadosAreaIds' || undefined}
        >
          <span
            className={`vc-ficha-label ${
              invalidField === 'serviciosSolicitadosAreaIds' ? 'text-status-danger' : ''
            }`}
          >
            Servicios solicitados *
          </span>
          <MultiSelect
            size="lg"
            label="Servicios solicitados *"
            placeholder="Selecciona una o más áreas…"
            options={areaOptions}
            value={value.serviciosSolicitadosAreaIds.map(String)}
            onChange={(vals) => update('serviciosSolicitadosAreaIds', vals.map(Number))}
          />
        </div>

        <div className="grid gap-3 rounded-2xl bg-surface-container-low p-4 sm:grid-cols-2">
          {IDENTITY_FLAGS.map((flag) => (
            <GlassSwitch
              key={flag.key}
              checked={value[flag.key]}
              onChange={(checked) => update(flag.key, checked)}
            >
              {flag.label}
            </GlassSwitch>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          <span>Al guardar el expediente se registra la aceptación del Aviso de Privacidad Simplificado.</span>
          <PrivacyNoticeDialog />
        </div>
      </section>
    </div>
  );
}
