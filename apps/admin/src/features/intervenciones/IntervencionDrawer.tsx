import { useState } from 'react';
import { Drawer, EmptyState, Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/drawer';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { ESTADO_CITA_LABELS, type AgendaItem } from '@/domain/models/Cita';
import { Icon } from '@/shared/ui/Icon';
import { ExpedienteTimeline } from './ExpedienteTimeline';
import { NotasPrivadasPanel } from './NotasPrivadasPanel';
import { SeguimientoForm } from './SeguimientoForm';
import { useContextoCita } from './api';
import { formatFechaHora } from './formatters';

type Tab = 'hoja' | 'timeline' | 'notas';

const TABS: readonly { id: Tab; label: string; icon: string }[] = [
  { id: 'hoja', label: 'Hoja de seguimiento', icon: 'edit_note' },
  { id: 'timeline', label: 'Línea de tiempo', icon: 'timeline' },
  { id: 'notas', label: 'Notas privadas', icon: 'lock' },
];

export interface IntervencionDrawerProps {
  cita: AgendaItem | null;
  open: boolean;
  canRegister: boolean;
  permiteAgendar: boolean;
  areaId: number | null;
  onOpenChange: (open: boolean) => void;
  onAfterClose?: () => void;
}

interface BodyProps extends Omit<IntervencionDrawerProps, 'cita' | 'open' | 'onOpenChange' | 'onAfterClose'> {
  cita: AgendaItem;
  onDone: () => void;
}

function IntervencionDrawerBody({ cita, canRegister, permiteAgendar, areaId, onDone }: BodyProps) {
  const [tab, setTab] = useState<Tab>(canRegister ? 'hoja' : 'timeline');
  const contextoQuery = useContextoCita(cita.citaId, cita.personaId);
  const contexto = contextoQuery.data;
  const tabs = canRegister ? TABS : TABS.filter((t) => t.id !== 'hoja');

  if (contextoQuery.isLoading) {
    return <Skeleton loading shape="card" lines={5} label="Cargando expediente" />;
  }
  if (contextoQuery.isError) {
    return (
      <EmptyState
        illustration="error"
        title="No se pudo cargar el expediente"
        actions={[{ id: 'retry', label: 'Reintentar' }]}
        onAction={() => void contextoQuery.refetch()}
      />
    );
  }
  if (!contexto) {
    return (
      <EmptyState
        illustration="search"
        title="La persona aún no tiene Ficha Única"
        description="Trabajo Social debe registrar la Ficha Única antes de llenar la hoja de seguimiento."
      />
    );
  }

  return (
    <div className="grid gap-5">
      <div role="tablist" aria-label="Secciones de la intervención" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`mk-chip mk-chip--filter inline-flex items-center gap-1.5 ${
              tab === t.id ? 'bg-secondary-container text-on-secondary-container' : ''
            }`}
          >
            <Icon name={t.icon} className="text-base" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'hoja' && canRegister ? (
          <SeguimientoForm
            cita={cita}
            contexto={contexto}
            areaId={areaId}
            permiteAgendar={permiteAgendar}
            onDone={onDone}
          />
        ) : null}
        {tab === 'timeline' ? <ExpedienteTimeline fichaId={contexto.fichaId} /> : null}
        {tab === 'notas' ? <NotasPrivadasPanel fichaId={contexto.fichaId} /> : null}
      </div>
    </div>
  );
}

/** Panel lateral para registrar la sesión y consultar línea de tiempo y notas del expediente. */
export function IntervencionDrawer({
  cita,
  open,
  onOpenChange,
  onAfterClose,
  ...rest
}: IntervencionDrawerProps) {
  return (
    <Drawer.Root side="right" open={open} onOpenChange={onOpenChange} onAfterClose={onAfterClose}>
      <Drawer.Content size="lg" dividers>
        <Drawer.Header>
          <div className="min-w-0 flex-1">
            <Drawer.Title>{cita?.nombreCompleto ?? 'Intervención'}</Drawer.Title>
            {cita ? (
              <Drawer.Description>
                Cita {formatFechaHora(cita.programadaEn)} · {ESTADO_CITA_LABELS[cita.estado]}
              </Drawer.Description>
            ) : null}
          </div>
          <Drawer.Close label="Cerrar intervención" />
        </Drawer.Header>
        <Drawer.Body>
          {cita ? (
            <IntervencionDrawerBody
              key={cita.citaId}
              cita={cita}
              {...rest}
              onDone={() => onOpenChange(false)}
            />
          ) : null}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}
