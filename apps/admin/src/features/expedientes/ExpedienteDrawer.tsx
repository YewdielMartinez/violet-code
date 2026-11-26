import { useState, type CSSProperties } from 'react';
import { Drawer } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/drawer';
import type { StaffRole } from '@/domain/models/Auth';
import { ESTADO_FICHA_LABELS, type ExpedienteResumen } from '@/domain/models/Persona';
import { Icon } from '@/shared/ui/Icon';
import { puedeAccederAgresor } from './agresorApi';
import { AgresorFormSection } from './AgresorFormSection';
import { DocumentosAdjuntosPanel } from './DocumentosAdjuntosPanel';

type DrawerTab = 'resumen' | 'agresor' | 'documentos';

const DRAWER_WIDTH_STYLE = { '--mk-drawer-width': '680px' } as CSSProperties;

const DATE_FMT = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_FMT.format(date);
}

interface Props {
  expediente: ExpedienteResumen | null;
  userRole: StaffRole | undefined;
  onClose: () => void;
}

/**
 * Panel lateral derecho de detalle de expediente (`RF-05`, `RF-22`).
 * Las pestañas «Persona agresora» y «Documentos» no se renderizan para roles sin acceso
 * (`recepcion`, `umeca`).
 */
export function ExpedienteDrawer({ expediente, userRole, onClose }: Props) {
  const canAccessSensitiveTabs = puedeAccederAgresor(userRole);
  const [tabState, setTabState] = useState<{ fichaId: string | null; tab: DrawerTab }>({
    fichaId: null,
    tab: 'resumen',
  });

  const requestedTab: DrawerTab =
    expediente && tabState.fichaId === expediente.id ? tabState.tab : 'resumen';
  const activeTab: DrawerTab = canAccessSensitiveTabs ? requestedTab : 'resumen';

  function selectTab(next: DrawerTab) {
    if (!expediente) return;
    setTabState({ fichaId: expediente.id, tab: next });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setTabState({ fichaId: null, tab: 'resumen' });
      onClose();
    }
  }

  return (
    <Drawer.Root side="right" open={Boolean(expediente)} onOpenChange={handleOpenChange}>
      <Drawer.Content style={DRAWER_WIDTH_STYLE}>
        <Drawer.Header>
          <Drawer.Title>
            {expediente ? `Expediente ${expediente.folio}` : 'Detalle del expediente'}
          </Drawer.Title>
          <Drawer.Close label="Cerrar" />
        </Drawer.Header>

        <Drawer.Body>
          {expediente ? (
            <div className="grid gap-4">
              <div
                role="tablist"
                aria-label="Secciones del expediente"
                className="flex flex-wrap gap-1.5 border-b border-outline-variant pb-3"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'resumen'}
                  onClick={() => selectTab('resumen')}
                  className={`mk-chip mk-chip--filter ${
                    activeTab === 'resumen' ? 'bg-secondary-container text-on-secondary-container' : ''
                  }`}
                >
                  <Icon name="badge" className="mr-1.5 text-[18px]" />
                  <span>Resumen</span>
                </button>

                {canAccessSensitiveTabs ? (
                  <>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'agresor'}
                      onClick={() => selectTab('agresor')}
                      className={`mk-chip mk-chip--filter ${
                        activeTab === 'agresor'
                          ? 'bg-secondary-container text-on-secondary-container'
                          : ''
                      }`}
                    >
                      <Icon name="shield_person" className="mr-1.5 text-[18px]" />
                      <span>Persona agresora</span>
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'documentos'}
                      onClick={() => selectTab('documentos')}
                      className={`mk-chip mk-chip--filter ${
                        activeTab === 'documentos'
                          ? 'bg-secondary-container text-on-secondary-container'
                          : ''
                      }`}
                    >
                      <Icon name="folder_open" className="mr-1.5 text-[18px]" />
                      <span>Documentos</span>
                    </button>
                  </>
                ) : null}
              </div>

              {activeTab === 'resumen' ? (
                <div role="tabpanel" className="grid gap-4">
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
                      Consulta registrada en bitácora (RF-22)
                    </span>
                  </div>

                  <dl className="grid gap-3 rounded-2xl bg-surface-container-low p-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium text-on-surface-variant">Nombre completo</dt>
                      <dd className="mt-0.5 text-sm font-medium text-on-surface">
                        {expediente.persona.nombreCompleto}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-on-surface-variant">CURP</dt>
                      <dd className="mt-0.5 font-mono text-sm text-on-surface">
                        {expediente.persona.curp}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-on-surface-variant">
                        Fecha de nacimiento / Sexo
                      </dt>
                      <dd className="mt-0.5 text-sm text-on-surface">
                        {expediente.persona.fechaNacimiento} · {expediente.persona.entidadNacimiento}{' '}
                        · {expediente.persona.sexo}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-on-surface-variant">Teléfono celular</dt>
                      <dd className="mt-0.5 font-mono text-sm text-on-surface">
                        {expediente.persona.celular ?? 'No registrado'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-on-surface-variant">
                        Alta del expediente
                      </dt>
                      <dd className="mt-0.5 text-sm text-on-surface">
                        {formatDate(expediente.creadoEn)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-on-surface-variant">
                        Última actualización
                      </dt>
                      <dd className="mt-0.5 text-sm text-on-surface">
                        {formatDate(expediente.actualizadoEn)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {canAccessSensitiveTabs && activeTab === 'agresor' ? (
                <div role="tabpanel">
                  <AgresorFormSection key={expediente.id} fichaId={expediente.id} />
                </div>
              ) : null}

              {canAccessSensitiveTabs && activeTab === 'documentos' ? (
                <div role="tabpanel">
                  <DocumentosAdjuntosPanel key={expediente.id} fichaId={expediente.id} />
                </div>
              ) : null}
            </div>
          ) : null}
        </Drawer.Body>

        <Drawer.Footer>
          <button
            type="button"
            className="mk-button mk-button--filled"
            onClick={() => handleOpenChange(false)}
          >
            Cerrar
          </button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer.Root>
  );
}
