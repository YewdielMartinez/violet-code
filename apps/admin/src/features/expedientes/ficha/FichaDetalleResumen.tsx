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
import { useFichaDetail, type ExpedienteResumen } from '../api';
import { DataSection, Dato, DatoGrid } from '../datos/DataSection';
import { FichaDatosEditForm, FichaDomicilioEditForm, FichaEstudioEditForm } from './FichaEditForms';

interface Props {
  expediente: ExpedienteResumen;
}

type SectionId = 'ficha' | 'domicilio' | 'estudio';

function formatBooleanField(value: boolean | null): string | null {
  if (value === null || value === undefined) return null;
  return value ? 'Sí' : 'No';
}

/**
 * Secciones «Identificación y ficha», «Domicilio» y «Estudio socioeconómico» (Ficha Única,
 * Domicilio SEPOMEX y Estudio Socioeconómico) de la pestaña «Datos». Cada una alterna entre vista
 * y formulario con una transición animada (`DataSection`); solo una se edita a la vez.
 */
export function FichaDetalleResumen({ expediente }: Props) {
  const { user } = useAuth();
  const { data: detail, isLoading } = useFichaDetail(expediente.id);
  const [editingSection, setEditingSection] = useState<SectionId | null>(null);
  const [savedTicks, setSavedTicks] = useState<Record<SectionId, number>>({
    ficha: 0,
    domicilio: 0,
    estudio: 0,
  });

  const canEdit = expediente.estado !== 'archivado' && puedeEditarExpediente(user?.role);

  function finishEditing(section: SectionId) {
    setEditingSection(null);
    setSavedTicks((prev) => ({ ...prev, [section]: prev[section] + 1 }));
  }

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
    <section aria-label="Datos adicionales" className="vc-datos-adicionales">
      <Skeleton loading={isLoading} shape="card" lines={5} label="Cargando detalle">
        {detail ? (
          <div className="grid gap-8">
            <DataSection
              title="Identificación y ficha"
              editLabel="identificación y ficha"
              canEdit={canEdit}
              editing={editingSection === 'ficha'}
              onStartEdit={() => setEditingSection('ficha')}
              savedTick={savedTicks.ficha}
              editForm={
                <FichaDatosEditForm
                  detail={detail}
                  onCancel={() => setEditingSection(null)}
                  onSaved={() => finishEditing('ficha')}
                />
              }
            >
              <DatoGrid>
                <Dato
                  label="Estado civil"
                  value={detail.estadoCivil ? ESTADO_CIVIL_LABELS[detail.estadoCivil] : null}
                />
                <Dato label="Ocupación" value={ocupacionLabel} />
                <Dato label="Servicio médico" value={servicioMedicoLabel} />
                <Dato label="Entidad de nacimiento" value={detail.persona.entidadNacimiento} mono />
                <Dato label="Trabajo remunerado" value={formatBooleanField(detail.tieneTrabajo)} />
                <Dato
                  label="Hijas / Hijos"
                  value={
                    detail.numeroHijas !== null || detail.numeroHijosHombres !== null
                      ? `${detail.numeroHijas ?? 0} hijas · ${detail.numeroHijosHombres ?? 0} hijos`
                      : null
                  }
                  mono
                />
                <Dato label="Embarazo actual" value={formatBooleanField(detail.tieneEmbarazo)} />
                <Dato label="Denuncia previa" value={formatBooleanField(detail.tieneDenuncia)} />
                <Dato label="Víctima de delito" value={formatBooleanField(detail.esVictimaDelito)} />
                <Dato
                  label="Consumo de alcohol"
                  value={detail.consumoAlcohol ? CONSUMO_ALCOHOL_LABELS[detail.consumoAlcohol] : null}
                />
                <Dato label="Consumo de sustancias" value={drogasLabel} fullWidth />
                <Dato
                  label="Servicios solicitados"
                  value={
                    detail.serviciosSolicitados.length > 0
                      ? detail.serviciosSolicitados.join(' · ')
                      : null
                  }
                  fullWidth
                />
              </DatoGrid>
            </DataSection>

            <DataSection
              title="Domicilio"
              editLabel="domicilio"
              canEdit={canEdit}
              editing={editingSection === 'domicilio'}
              onStartEdit={() => setEditingSection('domicilio')}
              savedTick={savedTicks.domicilio}
              editForm={
                <FichaDomicilioEditForm
                  detail={detail}
                  onCancel={() => setEditingSection(null)}
                  onSaved={() => finishEditing('domicilio')}
                />
              }
            >
              <DatoGrid>
                <Dato label="Dirección" value={direccionLabel} />
                <Dato label="Asentamiento / CP" value={asentamientoLabel} />
                <Dato label="Referencias" value={detail.domicilio?.referencias} fullWidth />
              </DatoGrid>
            </DataSection>

            <DataSection
              title="Estudio socioeconómico"
              editLabel="estudio socioeconómico"
              canEdit={canEdit}
              editing={editingSection === 'estudio'}
              onStartEdit={() => setEditingSection('estudio')}
              savedTick={savedTicks.estudio}
              editForm={
                <FichaEstudioEditForm
                  detail={detail}
                  onCancel={() => setEditingSection(null)}
                  onSaved={() => finishEditing('estudio')}
                />
              }
            >
              <DatoGrid>
                <Dato
                  label="Ingreso mensual propio"
                  value={
                    detail.estudio && detail.estudio.ingresoMensualPropio !== null
                      ? `$${detail.estudio.ingresoMensualPropio.toFixed(2)}`
                      : null
                  }
                  mono
                />
                <Dato
                  label="Dependientes"
                  value={detail.estudio ? String(detail.estudio.numeroDependientes ?? 0) : null}
                  mono
                />
                <Dato
                  label="Tipo de vivienda"
                  value={
                    detail.estudio?.tipoVivienda
                      ? TIPO_VIVIENDA_LABELS[detail.estudio.tipoVivienda]
                      : null
                  }
                />
                <Dato label="Material de vivienda" value={materialLabel} />

                <Dato
                  label={`Aportantes del hogar${
                    detail.estudio && detail.estudio.aportantes.length > 0
                      ? ` (${detail.estudio.aportantes.length})`
                      : ''
                  }`}
                  fullWidth
                >
                  {detail.estudio && detail.estudio.aportantes.length > 0 ? (
                    <ul className="vc-aportantes">
                      {detail.estudio.aportantes.map((ap) => (
                        <li key={ap.id} className="vc-aportantes__item">
                          <span className="vc-aportantes__name">
                            {ap.nombre}
                            {ap.parentescoNombre ? ` · ${ap.parentescoNombre}` : ''}
                          </span>
                          <span className="vc-aportantes__amount">
                            {ap.monto !== null ? `$${ap.monto.toFixed(2)}` : 'Sin registrar'}
                            {ap.frecuencia ? ` (${FRECUENCIA_INGRESO_LABELS[ap.frecuencia]})` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="vc-dato__value vc-dato__value--empty">Sin registrar</p>
                  )}
                </Dato>
              </DatoGrid>
            </DataSection>
          </div>
        ) : (
          <p className="vc-dato vc-dato__value vc-dato__value--empty">Sin registrar</p>
        )}
      </Skeleton>
    </section>
  );
}
