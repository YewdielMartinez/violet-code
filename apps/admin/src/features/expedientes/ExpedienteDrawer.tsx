import { type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Drawer } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/drawer';
import type { StaffRole } from '@/domain/models/Auth';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { Icon } from '@/shared/ui/Icon';
import { puedeAccederAgresor } from './agresorApi';
import { AgresorFormSection } from './AgresorFormSection';
import { DocumentosAdjuntosPanel } from './DocumentosAdjuntosPanel';
import { FichaDetalleResumen } from './ficha/FichaDetalleResumen';
import { FichaGestionAcciones } from './ficha/FichaGestionAcciones';

type DrawerTab = 'resumen' | 'agresor' | 'documentos';

const DRAWER_WIDTH_STYLE = { '--mk-drawer-width': '680px' } as CSSProperties;

interface Props {
  expediente: ExpedienteResumen | null;
  userRole: StaffRole | undefined;
  canManage: boolean;
  onClose: () => void;
}

/**
 * Panel lateral derecho de detalle de expediente (`RF-05`, `RF-22`).
 * Las pestañas «Persona agresora» y «Documentos» no se renderizan para roles sin acceso
 * (`recepcion`, `umeca`).
 */
export function ExpedienteDrawer({ expediente, userRole, canManage, onClose }: Props) {
  const canAccessSensitiveTabs = puedeAccederAgresor(userRole);
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab');
  const requestedTab: DrawerTab =
    rawTab === 'agresor' || rawTab === 'documentos' ? rawTab : 'resumen';
  const activeTab: DrawerTab = canAccessSensitiveTabs ? requestedTab : 'resumen';

  function selectTab(next: DrawerTab) {
    if (!expediente) return;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'resumen') params.delete('tab');
        else params.set('tab', next);
        return params;
      },
      { replace: true },
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
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
                <div role="tabpanel">
                  <FichaDetalleResumen expediente={expediente} />
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
          {canManage && expediente ? (
            <FichaGestionAcciones expediente={expediente} onDone={() => handleOpenChange(false)} />
          ) : null}
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
