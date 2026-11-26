import { Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/skeleton';
import {
  FRECUENCIA_INGRESO_LABELS,
  MATERIAL_VIVIENDA_LABELS,
  TIPO_VIVIENDA_LABELS,
} from '@/domain/models/EstudioSocioeconomico';
import { ESTADO_CIVIL_LABELS, SERVICIO_MEDICO_LABELS } from '@/domain/models/FichaRegistro';
import { useFichaDetail, type ExpedienteResumen } from '../api';

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
      className={`rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 ${
        fullWidth ? 'sm:col-span-2' : ''
      }`}
    >
      <p className="text-xs text-on-surface-variant">{label}</p>
      {clean ? (
        <p className={`mt-1 text-sm font-medium text-on-surface ${mono ? 'font-mono' : ''}`}>
          {clean}
        </p>
      ) : (
        <p className="mt-1 text-sm text-on-surface-variant/70">Sin registrar</p>
      )}
    </div>
  );
}

/**
 * Sección «Datos adicionales» del expediente (Ficha Única, Domicilio SEPOMEX y Estudio
 * Socioeconómico) presentada en tarjetas de dos columnas dentro de la pestaña «Datos».
 */
export function FichaDetalleResumen({ expediente }: Props) {
  const { data: detail, isLoading } = useFichaDetail(expediente.id);

  const servicioMedicoLabel = detail?.servicioMedico
    ? detail.servicioMedico === 'otro' && detail.servicioMedicoOtro
      ? detail.servicioMedicoOtro
      : SERVICIO_MEDICO_LABELS[detail.servicioMedico]
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
        ? `Foráneo CP ${detail.domicilio.codigoPostal}`
        : null
    : null;

  const materialLabel = detail?.estudio?.material
    ? detail.estudio.material === 'otro' && detail.estudio.materialOtro
      ? detail.estudio.materialOtro
      : MATERIAL_VIVIENDA_LABELS[detail.estudio.material]
    : null;

  return (
    <section aria-label="Datos adicionales" className="grid gap-3">
      <h4 className="text-sm font-medium text-on-surface">Datos adicionales</h4>

      <Skeleton loading={isLoading} shape="card" lines={5} label="Cargando detalle">
        {detail ? (
          <div className="grid gap-5">
            <section aria-label="Identificación">
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
                IDENTIFICACIÓN
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <InfoFieldCard
                  label="Estado civil"
                  value={detail.estadoCivil ? ESTADO_CIVIL_LABELS[detail.estadoCivil] : null}
                />
                <InfoFieldCard label="Ocupación" value={detail.ocupacionNombre} />
                <InfoFieldCard label="Servicio médico" value={servicioMedicoLabel} />
                <InfoFieldCard
                  label="Entidad de nacimiento"
                  value={detail.persona.entidadNacimiento}
                  mono
                />
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
            </section>

            <section aria-label="Domicilio">
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
                DOMICILIO
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <InfoFieldCard label="Dirección" value={direccionLabel} />
                <InfoFieldCard label="Asentamiento / CP" value={asentamientoLabel} />
                <InfoFieldCard
                  label="Referencias"
                  value={detail.domicilio?.referencias}
                  fullWidth
                />
              </div>
            </section>

            <section aria-label="Estudio socioeconómico">
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
                ESTUDIO SOCIOECONÓMICO
              </p>
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

                <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 sm:col-span-2">
                  <p className="text-xs text-on-surface-variant">
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
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs"
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
                    <p className="mt-1 text-sm text-on-surface-variant/70">Sin registrar</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        ) : (
          <p className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant/70">
            Sin registrar
          </p>
        )}
      </Skeleton>
    </section>
  );
}
