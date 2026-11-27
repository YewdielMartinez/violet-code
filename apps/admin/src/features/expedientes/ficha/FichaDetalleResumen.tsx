import { useState } from 'react';
import { Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { DROGA_LABELS } from '@/domain/models/Agresor';
import {
  FRECUENCIA_INGRESO_LABELS,
  MATERIAL_VIVIENDA_LABELS,
  TIPO_VIVIENDA_LABELS,
} from '@/domain/models/EstudioSocioeconomico';
import {
  CONSUMO_ALCOHOL_LABELS,
  ESTADO_CIVIL_LABELS,
  SERVICIO_MEDICO_LABELS,
  puedeEditarExpediente,
} from '@/domain/models/FichaRegistro';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { useFichaDetail, type ExpedienteResumen } from '../api';
import { FichaDatosEditForm, FichaDomicilioEditForm, FichaEstudioEditForm } from './FichaEditForms';

interface Props {
  expediente: ExpedienteResumen;
}

interface FieldCardProps {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  fullWidth?: boolean;
}

function InfoFieldCard({ label, value, mono = false, fullWidth = false }: FieldCardProps) {
  const clean = value?.trim() || null;

  return (
    <div
      className={`rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5 ${
        fullWidth ? 'sm:col-span-2' : ''
      }`}
    >
      <p className="text-sm font-medium text-on-surface-variant">{label}</p>
      {clean ? (
        <p className={`mt-1 text-base font-medium text-on-surface ${mono ? 'font-mono' : ''}`}>
          {clean}
        </p>
      ) : (
        <p className="mt-1 text-base text-on-surface-variant">Sin registrar</p>
      )}
    </div>
  );
}

type EditSection = 'ficha' | 'domicilio' | 'estudio' | null;

function formatBooleanField(value: boolean | null): string | null {
  if (value === null || value === undefined) return null;
  return value ? 'Sí' : 'No';
}

/**
 * Sección «Datos adicionales» del expediente (Ficha Única, Domicilio SEPOMEX y Estudio
 * Socioeconómico) presentada en tarjetas de dos columnas dentro de la pestaña «Datos».
 */
export function FichaDetalleResumen({ expediente }: Props) {
  const { user } = useAuth();
  const { data: detail, isLoading } = useFichaDetail(expediente.id);
  const [editingSection, setEditingSection] = useState<EditSection>(null);

  const canEdit = expediente.estado !== 'archivado' && puedeEditarExpediente(user?.role);

  const servicioMedicoLabel = detail?.servicioMedico
    ? detail.servicioMedico === 'otro' && detail.servicioMedicoOtro
      ? detail.servicioMedicoOtro
      : SERVICIO_MEDICO_LABELS[detail.servicioMedico]
    : null;

  const ocupacionLabel = detail?.ocupacionNombre
    ? detail.ocupacionOtra
      ? `${detail.ocupacionNombre} (${detail.ocupacionOtra})`
      : detail.ocupacionNombre
    : detail?.ocupacionOtra || null;

  const drogasLabel =
    detail && detail.drogas.length > 0
      ? detail.drogas
          .map((d) =>
            d === 'otra' && detail.especificacionDroga
              ? `Otra (${detail.especificacionDroga})`
              : DROGA_LABELS[d],
          )
          .join(', ')
      : null;

  const direccionLabel = detail?.domicilio
    ? [
        detail.domicilio.calle,
        detail.domicilio.numeroExterior,
        detail.domicilio.numeroInterior ? `Int. ${detail.domicilio.numeroInterior}` : null,
      ]
        .filter(Boolean)
        .join(' ') || null
    : null;

  const asentamientoLabel = detail?.domicilio
    ? detail.domicilio.asentamientoNombre
      ? `${detail.domicilio.asentamientoNombre}${
          detail.domicilio.codigoPostal ? ` (${detail.domicilio.codigoPostal})` : ''
        }`
      : detail.domicilio.codigoPostal
        ? `CP ${detail.domicilio.codigoPostal}`
        : null
    : null;

  const materialLabel = detail?.estudio?.material
    ? detail.estudio.material === 'otro' && detail.estudio.materialOtro
      ? detail.estudio.materialOtro
      : MATERIAL_VIVIENDA_LABELS[detail.estudio.material]
    : null;

  return (
    <section aria-label="Datos adicionales" className="grid gap-3">
      <h4 className="text-base font-semibold text-on-surface">Datos adicionales</h4>

      <Skeleton loading={isLoading} shape="card" lines={5} label="Cargando detalle">
        {detail ? (
          <div className="grid gap-5">
            <section aria-label="Identificación">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">
                  IDENTIFICACIÓN Y FICHA
                </p>
                {canEdit && editingSection !== 'ficha' ? (
                  <button
                    type="button"
                    className="mk-button mk-button--tonal mk-button--sm"
                    onClick={() => setEditingSection('ficha')}
                  >
                    <Icon name="edit" />
                    <span>Editar</span>
                  </button>
                ) : null}
              </div>

              {editingSection === 'ficha' ? (
                <FichaDatosEditForm
                  detail={detail}
                  onCancel={() => setEditingSection(null)}
                  onSaved={() => setEditingSection(null)}
                />
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <InfoFieldCard
                    label="Estado civil"
                    value={detail.estadoCivil ? ESTADO_CIVIL_LABELS[detail.estadoCivil] : null}
                  />
                  <InfoFieldCard label="Ocupación" value={ocupacionLabel} />
                  <InfoFieldCard label="Servicio médico" value={servicioMedicoLabel} />
                  <InfoFieldCard
                    label="Entidad de nacimiento"
                    value={detail.persona.entidadNacimiento}
                    mono
                  />
                  <InfoFieldCard
                    label="Trabajo remunerado"
                    value={formatBooleanField(detail.tieneTrabajo)}
                  />
                  <InfoFieldCard
                    label="Hijas / Hijos"
                    value={
                      detail.numeroHijas !== null || detail.numeroHijosHombres !== null
                        ? `${detail.numeroHijas ?? 0} hijas · ${detail.numeroHijosHombres ?? 0} hijos`
                        : null
                    }
                    mono
                  />
                  <InfoFieldCard
                    label="Embarazo actual"
                    value={formatBooleanField(detail.tieneEmbarazo)}
                  />
                  <InfoFieldCard
                    label="Denuncia previa"
                    value={formatBooleanField(detail.tieneDenuncia)}
                  />
                  <InfoFieldCard
                    label="Víctima de delito"
                    value={formatBooleanField(detail.esVictimaDelito)}
                  />
                  <InfoFieldCard
                    label="Consumo de alcohol"
                    value={
                      detail.consumoAlcohol ? CONSUMO_ALCOHOL_LABELS[detail.consumoAlcohol] : null
                    }
                  />
                  <InfoFieldCard label="Consumo de sustancias" value={drogasLabel} fullWidth />
                  <InfoFieldCard
                    label="Servicios solicitados"
                    value={
                      detail.serviciosSolicitados.length > 0
                        ? detail.serviciosSolicitados.join(' · ')
                        : null
                    }
                    fullWidth
                  />
                </div>
              )}
            </section>

            <section aria-label="Domicilio">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">
                  DOMICILIO
                </p>
                {canEdit && editingSection !== 'domicilio' ? (
                  <button
                    type="button"
                    className="mk-button mk-button--tonal mk-button--sm"
                    onClick={() => setEditingSection('domicilio')}
                  >
                    <Icon name="edit" />
                    <span>Editar</span>
                  </button>
                ) : null}
              </div>

              {editingSection === 'domicilio' ? (
                <FichaDomicilioEditForm
                  detail={detail}
                  onCancel={() => setEditingSection(null)}
                  onSaved={() => setEditingSection(null)}
                />
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <InfoFieldCard label="Dirección" value={direccionLabel} />
                  <InfoFieldCard label="Asentamiento / CP" value={asentamientoLabel} />
                  <InfoFieldCard
                    label="Referencias"
                    value={detail.domicilio?.referencias}
                    fullWidth
                  />
                </div>
              )}
            </section>

            <section aria-label="Estudio socioeconómico">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">
                  ESTUDIO SOCIOECONÓMICO
                </p>
                {canEdit && editingSection !== 'estudio' ? (
                  <button
                    type="button"
                    className="mk-button mk-button--tonal mk-button--sm"
                    onClick={() => setEditingSection('estudio')}
                  >
                    <Icon name="edit" />
                    <span>Editar</span>
                  </button>
                ) : null}
              </div>

              {editingSection === 'estudio' ? (
                <FichaEstudioEditForm
                  detail={detail}
                  onCancel={() => setEditingSection(null)}
                  onSaved={() => setEditingSection(null)}
                />
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <InfoFieldCard
                    label="Ingreso mensual propio"
                    value={
                      detail.estudio && detail.estudio.ingresoMensualPropio !== null
                        ? `$${detail.estudio.ingresoMensualPropio.toFixed(2)}`
                        : null
                    }
                    mono
                  />
                  <InfoFieldCard
                    label="Dependientes"
                    value={detail.estudio ? String(detail.estudio.numeroDependientes ?? 0) : null}
                    mono
                  />
                  <InfoFieldCard
                    label="Tipo de vivienda"
                    value={
                      detail.estudio?.tipoVivienda
                        ? TIPO_VIVIENDA_LABELS[detail.estudio.tipoVivienda]
                        : null
                    }
                  />
                  <InfoFieldCard label="Material de vivienda" value={materialLabel} />

                  <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5 sm:col-span-2">
                    <p className="text-sm font-medium text-on-surface-variant">
                      Aportantes del hogar
                      {detail.estudio && detail.estudio.aportantes.length > 0
                        ? ` (${detail.estudio.aportantes.length})`
                        : ''}
                    </p>
                    {detail.estudio && detail.estudio.aportantes.length > 0 ? (
                      <ul className="mt-2 grid gap-1.5">
                        {detail.estudio.aportantes.map((ap) => (
                          <li
                            key={ap.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-container-low px-4 py-3 text-base"
                          >
                            <span className="font-medium text-on-surface">
                              {ap.nombre}
                              {ap.parentescoNombre ? ` · ${ap.parentescoNombre}` : ''}
                            </span>
                            <span className="font-mono text-on-surface-variant">
                              {ap.monto !== null ? `$${ap.monto.toFixed(2)}` : 'Sin registrar'}
                              {ap.frecuencia ? ` (${FRECUENCIA_INGRESO_LABELS[ap.frecuencia]})` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-base text-on-surface-variant">Sin registrar</p>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          <p className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5 text-base text-on-surface-variant">
            Sin registrar
          </p>
        )}
      </Skeleton>
    </section>
  );
}
