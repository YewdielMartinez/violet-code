import { Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/skeleton';
import {
  FRECUENCIA_INGRESO_LABELS,
  MATERIAL_VIVIENDA_LABELS,
  TIPO_VIVIENDA_LABELS,
} from '@/domain/models/EstudioSocioeconomico';
import { ESTADO_CIVIL_LABELS, SERVICIO_MEDICO_LABELS } from '@/domain/models/FichaRegistro';
import { ESTADO_FICHA_LABELS, useFichaDetail, type ExpedienteResumen } from '../api';

interface Props {
  expediente: ExpedienteResumen;
}

/**
 * Consulta autorizada del expediente completo (Ficha Única, Domicilio SEPOMEX y Estudio Socioeconómico).
 * Se muestra en la pestaña «Resumen» del panel lateral del expediente.
 */
export function FichaDetalleResumen({ expediente }: Props) {
  const { data: detail, isLoading } = useFichaDetail(expediente.id);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-medium text-on-secondary-container">
          {ESTADO_FICHA_LABELS[expediente.estado]}
        </span>
        {expediente.enListaUrgencias ? (
          <span className="rounded-full bg-status-danger-bg px-3 py-1 text-xs font-medium text-status-danger">
            Caso prioritario
          </span>
        ) : null}
        <span className="text-xs text-on-surface-variant">
          Consulta auditada en bitácora (RF-22)
        </span>
      </div>

      <Skeleton loading={isLoading} shape="card" lines={5} label="Cargando detalle">
        {detail ? (
          <div className="grid gap-4">
            <section className="rounded-2xl bg-surface-container-low p-4">
              <h3 className="mb-2 text-sm font-medium text-on-surface">Ficha Única e Identidad</h3>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-on-surface-variant">Nombre completo</dt>
                  <dd className="font-medium text-on-surface">{detail.persona.nombreCompleto}</dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">CURP</dt>
                  <dd className="font-mono text-on-surface">{detail.persona.curp}</dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Celular</dt>
                  <dd className="font-mono text-on-surface">
                    {detail.persona.celular ?? 'No registrado'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Estado civil</dt>
                  <dd className="text-on-surface">
                    {detail.estadoCivil ? ESTADO_CIVIL_LABELS[detail.estadoCivil] : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Ocupación</dt>
                  <dd className="text-on-surface">{detail.ocupacionNombre ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Servicio médico</dt>
                  <dd className="text-on-surface">
                    {detail.servicioMedico
                      ? detail.servicioMedico === 'otro' && detail.servicioMedicoOtro
                        ? detail.servicioMedicoOtro
                        : SERVICIO_MEDICO_LABELS[detail.servicioMedico]
                      : '—'}
                  </dd>
                </div>
                <div className="sm:col-span-3">
                  <dt className="text-xs text-on-surface-variant">Servicios solicitados</dt>
                  <dd className="text-on-surface">
                    {detail.serviciosSolicitados.length > 0
                      ? detail.serviciosSolicitados.join(' · ')
                      : 'Sin áreas especificadas'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl bg-surface-container-low p-4">
              <h3 className="mb-2 text-sm font-medium text-on-surface">Domicilio actual</h3>
              {detail.domicilio ? (
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-on-surface-variant">Dirección</dt>
                    <dd className="text-on-surface">
                      {[
                        detail.domicilio.calle,
                        detail.domicilio.numeroExterior,
                        detail.domicilio.numeroInterior ? `Int. ${detail.domicilio.numeroInterior}` : null,
                      ]
                        .filter(Boolean)
                        .join(' ') || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-on-surface-variant">Asentamiento / CP</dt>
                    <dd className="text-on-surface">
                      {detail.domicilio.asentamientoNombre
                        ? `${detail.domicilio.asentamientoNombre} (${detail.domicilio.codigoPostal ?? ''})`
                        : `CP ${detail.domicilio.codigoPostal ?? '—'}`}
                    </dd>
                  </div>
                  {detail.domicilio.referencias ? (
                    <div className="sm:col-span-3">
                      <dt className="text-xs text-on-surface-variant">Referencias</dt>
                      <dd className="text-on-surface">{detail.domicilio.referencias}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="text-sm text-on-surface-variant">Sin domicilio actual registrado.</p>
              )}
            </section>

            <section className="rounded-2xl bg-surface-container-low p-4">
              <h3 className="mb-2 text-sm font-medium text-on-surface">Estudio Socioeconómico</h3>
              {detail.estudio ? (
                <div className="grid gap-3 text-sm">
                  <dl className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-on-surface-variant">Ingreso propio</dt>
                      <dd className="font-mono text-on-surface">
                        {detail.estudio.ingresoMensualPropio !== null
                          ? `$${detail.estudio.ingresoMensualPropio.toFixed(2)}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-on-surface-variant">Dependientes</dt>
                      <dd className="font-mono text-on-surface">
                        {detail.estudio.numeroDependientes ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-on-surface-variant">Vivienda</dt>
                      <dd className="text-on-surface">
                        {detail.estudio.tipoVivienda
                          ? TIPO_VIVIENDA_LABELS[detail.estudio.tipoVivienda]
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-on-surface-variant">Material</dt>
                      <dd className="text-on-surface">
                        {detail.estudio.material
                          ? detail.estudio.material === 'otro' && detail.estudio.materialOtro
                            ? detail.estudio.materialOtro
                            : MATERIAL_VIVIENDA_LABELS[detail.estudio.material]
                          : '—'}
                      </dd>
                    </div>
                  </dl>

                  {detail.estudio.aportantes.length > 0 ? (
                    <div>
                      <p className="mb-1 text-xs font-medium text-on-surface-variant">
                        Aportantes del hogar ({detail.estudio.aportantes.length})
                      </p>
                      <ul className="grid gap-1.5">
                        {detail.estudio.aportantes.map((ap) => (
                          <li
                            key={ap.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-container-lowest px-3 py-2 text-xs"
                          >
                            <span className="font-medium text-on-surface">
                              {ap.nombre}
                              {ap.parentescoNombre ? ` · ${ap.parentescoNombre}` : ''}
                            </span>
                            <span className="font-mono text-on-surface-variant">
                              {ap.monto !== null ? `$${ap.monto.toFixed(2)}` : '—'}
                              {ap.frecuencia ? ` (${FRECUENCIA_INGRESO_LABELS[ap.frecuencia]})` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">
                  Sin estudio socioeconómico registrado.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </Skeleton>
    </div>
  );
}
