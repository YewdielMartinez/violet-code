import { useMemo } from 'react';
import { Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/select';
import {
  hasFichaAgresorData,
  type AgresorValidationField,
  type FichaAgresorInput,
} from '@/domain/models/Agresor';
import type { CatalogosFicha } from '@/domain/models/FichaRegistro';
import { Icon } from '@/shared/ui/Icon';
import { AgresorConsumoArmaFields } from '../AgresorConsumoArmaFields';
import { AgresorDomicilioFields } from '../AgresorDomicilioFields';
import { AnimatedReveal } from '../agresor/AnimatedReveal';

interface Props {
  value: FichaAgresorInput;
  onChange: (next: FichaAgresorInput) => void;
  catalogos?: CatalogosFicha;
  errors?: Partial<Record<AgresorValidationField, string>>;
  invalidField?: string | null;
}

/**
 * Paso 3 (opcional) de la Ficha Única: captura de datos de la persona agresora.
 * Si la sección se deja vacía, se omite el registro y se puede avanzar libremente.
 * Si se captura cualquier dato, Nombre(s), Apellido paterno, Parentesco y Ocupación son obligatorios.
 */
export function FichaAgresorStep({
  value,
  onChange,
  catalogos,
  errors = {},
  invalidField,
}: Props) {

  const hasData = hasFichaAgresorData(value);

  const parentescos = useMemo(
    () => [...(catalogos?.parentescos ?? [])].sort((a, b) => a.id - b.id),
    [catalogos?.parentescos],
  );
  const ocupaciones = useMemo(
    () => [...(catalogos?.ocupaciones ?? [])].sort((a, b) => a.id - b.id),
    [catalogos?.ocupaciones],
  );

  const parentescoOptions = useMemo(
    () => parentescos.map((item) => ({ value: String(item.id), label: item.nombre })),
    [parentescos],
  );
  const ocupacionOptions = useMemo(
    () => ocupaciones.map((item) => ({ value: String(item.id), label: item.nombre })),
    [ocupaciones],
  );

  const selectedParentesco = parentescos.find((p) => p.id === value.parentescoId);
  const selectedOcupacion = ocupaciones.find((o) => o.id === value.ocupacionId);
  const mostrarParentescoOtro = selectedParentesco?.clave === 'otro';
  const mostrarOcupacionOtra = selectedOcupacion?.clave === 'otra';

  function patch(partial: Partial<FichaAgresorInput>) {
    onChange({ ...value, ...partial });
  }

  function handleParentescoChange(raw: string) {
    const nextId = raw ? Number(raw) : null;
    const nextClave = parentescos.find((p) => p.id === nextId)?.clave;
    patch({
      parentescoId: nextId,
      parentescoOtro: nextClave === 'otro' ? value.parentescoOtro : '',
    });
  }

  function handleOcupacionChange(raw: string) {
    const nextId = raw ? Number(raw) : null;
    const nextClave = ocupaciones.find((o) => o.id === nextId)?.clave;
    patch({
      ocupacionId: nextId,
      ocupacionOtra: nextClave === 'otra' ? value.ocupacionOtra : '',
    });
  }

  return (
    <div className="vc-ficha-form grid gap-6">
      <div className="flex items-start gap-2.5 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
        <Icon name="info" className="mt-0.5 shrink-0 text-primary" />
        <span>
          Sección opcional. Si no hay persona agresora identificada, puedes dejarla en blanco y continuar al siguiente paso. Si capturas datos, Nombre(s), Apellido paterno, Parentesco con la usuaria y Ocupación son obligatorios.
        </span>
      </div>

      <fieldset className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
          Identificación y vínculo
        </legend>

        <div className="grid gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-on-surface-variant">Nombre(s) *</label>
          <label className="mk-field">
            <input
              type="text"
              maxLength={100}
              required={hasData}
              data-ficha-field="agresor-nombres"
              aria-invalid={errors.nombres || invalidField === 'agresor-nombres' ? true : undefined}
              value={value.nombres}
              onChange={(e) => patch({ nombres: e.target.value })}
              placeholder="Nombre(s) de la persona agresora"
            />
          </label>
          {errors.nombres ? (
            <p role="alert" className="text-sm text-status-danger">
              {errors.nombres}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium text-on-surface-variant">Apellido paterno *</label>
          <label className="mk-field">
            <input
              type="text"
              maxLength={100}
              required={hasData}
              data-ficha-field="agresor-apellidoPaterno"
              aria-invalid={
                errors.apellidoPaterno || invalidField === 'agresor-apellidoPaterno' ? true : undefined
              }
              value={value.apellidoPaterno}
              onChange={(e) => patch({ apellidoPaterno: e.target.value })}
              placeholder="Primer apellido"
            />
          </label>
          {errors.apellidoPaterno ? (
            <p role="alert" className="text-sm text-status-danger">
              {errors.apellidoPaterno}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium text-on-surface-variant">Apellido materno</label>
          <label className="mk-field">
            <input
              type="text"
              maxLength={100}
              data-ficha-field="agresor-apellidoMaterno"
              aria-invalid={
                errors.apellidoMaterno || invalidField === 'agresor-apellidoMaterno' ? true : undefined
              }
              value={value.apellidoMaterno}
              onChange={(e) => patch({ apellidoMaterno: e.target.value })}
              placeholder="Segundo apellido (opcional)"
            />
          </label>
          {errors.apellidoMaterno ? (
            <p role="alert" className="text-sm text-status-danger">
              {errors.apellidoMaterno}
            </p>
          ) : null}
        </div>

        <div
          className="grid gap-1"
          data-ficha-field="agresor-parentescoId"
          data-ficha-invalid={errors.parentescoId || invalidField === 'agresor-parentescoId' ? true : undefined}
        >
          <span
            className={`text-sm font-medium ${errors.parentescoId ? 'text-status-danger' : 'text-on-surface-variant'}`}
          >
            Parentesco con la usuaria *
          </span>
          <Select
            size="lg"
            label="Parentesco con la usuaria *"
            placeholder="Selecciona…"
            options={parentescoOptions}
            value={value.parentescoId ? String(value.parentescoId) : ''}
            onChange={handleParentescoChange}
          />
          {errors.parentescoId ? (
            <p role="alert" className="text-sm text-status-danger">
              {errors.parentescoId}
            </p>
          ) : null}
        </div>

        <div
          className="grid gap-1"
          data-ficha-field="agresor-ocupacionId"
          data-ficha-invalid={errors.ocupacionId || invalidField === 'agresor-ocupacionId' ? true : undefined}
        >
          <span
            className={`text-sm font-medium ${errors.ocupacionId ? 'text-status-danger' : 'text-on-surface-variant'}`}
          >
            Ocupación *
          </span>
          <Select
            size="lg"
            label="Ocupación de la persona agresora *"
            placeholder="Selecciona…"
            options={ocupacionOptions}
            value={value.ocupacionId ? String(value.ocupacionId) : ''}
            onChange={handleOcupacionChange}
          />
          {errors.ocupacionId ? (
            <p role="alert" className="text-sm text-status-danger">
              {errors.ocupacionId}
            </p>
          ) : null}
        </div>

        <AnimatedReveal show={mostrarParentescoOtro} className="sm:col-span-2">
          <div className="grid gap-1 pt-1">
            <label className="text-sm font-medium text-on-surface-variant">
              Especifica el parentesco
            </label>
            <label className="mk-field">
              <input
                type="text"
                maxLength={120}
                data-ficha-field="agresor-parentescoOtro"
                aria-invalid={
                  errors.parentescoOtro || invalidField === 'agresor-parentescoOtro' ? true : undefined
                }
                value={value.parentescoOtro}
                onChange={(e) => patch({ parentescoOtro: e.target.value })}
              />
            </label>
            {errors.parentescoOtro ? (
              <p role="alert" className="text-sm text-status-danger">
                {errors.parentescoOtro}
              </p>
            ) : null}
          </div>
        </AnimatedReveal>

        <AnimatedReveal show={mostrarOcupacionOtra} className="sm:col-span-2">
          <div className="grid gap-1 pt-1">
            <label className="text-sm font-medium text-on-surface-variant">
              Especifica la ocupación
            </label>
            <label className="mk-field">
              <input
                type="text"
                maxLength={150}
                data-ficha-field="agresor-ocupacionOtra"
                aria-invalid={
                  errors.ocupacionOtra || invalidField === 'agresor-ocupacionOtra' ? true : undefined
                }
                value={value.ocupacionOtra}
                onChange={(e) => patch({ ocupacionOtra: e.target.value })}
              />
            </label>
            {errors.ocupacionOtra ? (
              <p role="alert" className="text-sm text-status-danger">
                {errors.ocupacionOtra}
              </p>
            ) : null}
          </div>
        </AnimatedReveal>
      </fieldset>

      <AgresorDomicilioFields
        values={value}
        errores={errors}
        onPatch={patch}
        surfaceClassName="bg-surface-container-lowest"
        fieldPrefix="agresor-"
      />

      <AgresorConsumoArmaFields
        values={value}
        errores={errors}
        onPatch={patch}
        surfaceClassName="bg-surface-container-lowest"
        fieldPrefix="agresor-"
      />
    </div>
  );
}
