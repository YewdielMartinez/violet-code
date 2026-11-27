import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { generatePath, Link, useSearchParams } from 'react-router-dom';
import { Dialog, useDialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import { HISTORIAL_CLINICO_PATH } from '@/app/navigation';
import type { StaffRole } from '@/domain/models/Auth';
import { puedeAccederHistorialClinico } from '@/domain/models/HistorialClinico';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { Icon } from '@/shared/ui/Icon';
import { puedeAccederAgresor } from './agresorApi';
import { AgresorFormSection } from './AgresorFormSection';
import { DerivacionesExpedientePanel } from './DerivacionesExpedientePanel';
import { DocumentosAdjuntosPanel } from './DocumentosAdjuntosPanel';
import { ExpedienteContactoSection } from './drawer/ExpedienteContactoSection';
import { ExpedienteDrawerTabs, type DrawerTab } from './drawer/ExpedienteDrawerTabs';
import { ExpedienteHeroCard } from './drawer/ExpedienteHeroCard';
import { ExpedienteTopBar } from './drawer/ExpedienteTopBar';
import './drawer/expediente-drawer.css';
import { FichaDetalleResumen } from './ficha/FichaDetalleResumen';
import { FichaGestionAcciones } from './ficha/FichaGestionAcciones';

type DialogInstanceRef = ReturnType<typeof useDialog>['instance'];

interface OriginBridgeProps {
  open: boolean;
  originElement: HTMLElement | null;
  instanceRef: DialogInstanceRef;
}

/**
 * Conecta el `origin` dinámico (fila de tabla) con `DialogInstance.open(origin)` antes de que
 * `Dialog.Content` ejecute su apertura genérica sin origen.
 */
function DialogOriginBridge({ open, originElement, instanceRef }: OriginBridgeProps) {
  const { instance } = useDialog();

  useLayoutEffect(() => {
    instanceRef.current = instance.current;
    if (open && instance.current && !instance.current.isOpen) {
      instance.current.open(originElement ?? undefined);
    }
  }, [open, originElement, instance, instanceRef]);

  useEffect(() => {
    instanceRef.current = instance.current;
  }, [open, instance, instanceRef]);

  return null;
}

interface Props {
  expediente: ExpedienteResumen | null;
  originElement?: HTMLElement | null;
  userRole: StaffRole | undefined;
  canManage: boolean;
  onClose: () => void;
}

/**
 * Panel lateral derecho de expediente (`RF-05`, `RF-22`).
 * Usa `Dialog` con `placement="side"` y `variant="morph"` para crecer desde la fila origen y
 * animar los elementos compartidos (`data-mk-shared`). Mantiene ocultas «Persona agresora» y
 * «Documentos» para `recepcion` y `umeca`.
 */
export function ExpedienteDrawer({
  expediente,
  originElement = null,
  userRole,
  canManage,
  onClose,
}: Props) {
  const canAccessSensitiveTabs = puedeAccederAgresor(userRole);
  const dialogInstanceRef = useRef<DialogInstanceRef['current']>(null);

  const [expanded, setExpanded] = useState(false);
  // La pestaña activa vive en la URL (`?tab=`), igual que el expediente abierto (`?expediente=`).
  const [searchParams, setSearchParams] = useSearchParams();

  const isOpen = Boolean(expediente);
  const rawTab = searchParams.get('tab');
  const requestedTab: DrawerTab =
    rawTab === 'agresor' || rawTab === 'documentos' || rawTab === 'canalizaciones'
      ? rawTab
      : 'resumen';
  const activeTab: DrawerTab = canAccessSensitiveTabs ? requestedTab : 'resumen';

  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previousOverflow;
      if (root.getAttribute('style') === '') root.removeAttribute('style');
    };
  }, [isOpen]);

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
      setExpanded(false);
      onClose();
    }
  }

  function requestClose() {
    if (dialogInstanceRef.current?.isOpen) {
      dialogInstanceRef.current.close();
      return;
    }
    handleOpenChange(false);
  }

  const widthStyle = {
    '--vc-drawer-width': expanded ? '960px' : '680px',
  } as CSSProperties;

  return (
    <Dialog.Root
      placement="side"
      variant="morph"
      sharedSplit="words"
      autoResize={false}
      drag={false}
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <Dialog.Content className="vc-expediente-dialog" style={widthStyle}>
        <DialogOriginBridge
          open={isOpen}
          originElement={originElement}
          instanceRef={dialogInstanceRef}
        />

        <ExpedienteTopBar
          expediente={expediente}
          expanded={expanded}
          onToggleExpand={() => setExpanded((prev) => !prev)}
        />

        <Dialog.Body>
          {expediente ? (
            <div className="grid gap-5">
              <ExpedienteHeroCard expediente={expediente} />

              {puedeAccederHistorialClinico(userRole) && (
                <Link
                  to={generatePath(HISTORIAL_CLINICO_PATH, { fichaId: expediente.id })}
                  className="mk-button mk-button--tonal justify-self-start"
                >
                  <Icon name="clinical_notes" /> Historial clínico
                </Link>
              )}

              <ExpedienteDrawerTabs
                activeTab={activeTab}
                canAccessSensitiveTabs={canAccessSensitiveTabs}
                expedienteId={expediente.id}
                onChange={selectTab}
              />

              {activeTab === 'resumen' ? (
                <div role="tabpanel" className="grid gap-6">
                  <ExpedienteContactoSection expediente={expediente} />
                  <FichaDetalleResumen expediente={expediente} />
                  {canManage ? (
                    <FichaGestionAcciones expediente={expediente} onDone={requestClose} />
                  ) : null}
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

              {canAccessSensitiveTabs && activeTab === 'canalizaciones' ? (
                <div role="tabpanel">
                  <DerivacionesExpedientePanel
                    key={expediente.id}
                    fichaId={expediente.id}
                    folio={expediente.folio}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
