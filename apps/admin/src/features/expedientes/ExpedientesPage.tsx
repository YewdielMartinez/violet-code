import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandSearch,
  DataTable,
  EmptyState,
  Skeleton,
  type CommandItem,
  type DataAction,
  type DataTableProps,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/command-search';
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import {
  ESTADO_FICHA_LABELS,
  canLookupPreRegistro,
  useExpedientes,
  useRegisterConsult,
  type ExpedienteResumen,
  type PreRegistroMovil,
} from './api';
import { FichaDetalleDialog } from './ficha/FichaDetalleDialog';
import type { FichaSeedContext } from './ficha/useFichaForm';
import { VerificarCurpDialog } from './VerificarCurpDialog';

type QuickFilter = 'todos' | 'abierto' | 'en_seguimiento' | 'prioritarios' | 'cerrado';

interface ExpedienteRow extends Record<string, unknown> {
  id: string;
  folio: string;
  nombreCompleto: string;
  curp: string;
  estado: string;
  urgencia: string;
  actualizadoLabel: string;
}

const ESTADO_OPTIONS = Object.entries(ESTADO_FICHA_LABELS).map(([value, label]) => ({ value, label }));
const URGENCIA_OPTIONS = [
  { value: 'Prioritario', label: 'Prioritario' },
  { value: 'Normal', label: 'Normal' },
];

// Configuraciones estáticas fuera del componente para preservar referencias en motion-kit.
const COLUMNS: DataTableProps<ExpedienteRow>['columns'] = [
  { key: 'folio', label: 'Folio', sortable: true, searchable: true },
  { key: 'nombreCompleto', label: 'Usuaria', sortable: true, searchable: true },
  { key: 'curp', label: 'CURP', sortable: true, searchable: true },
  {
    key: 'estado',
    label: 'Estado',
    type: 'select',
    filterable: true,
    options: ESTADO_OPTIONS,
  },
  {
    key: 'urgencia',
    label: 'Prioridad',
    type: 'select',
    filterable: true,
    options: URGENCIA_OPTIONS,
  },
  { key: 'actualizadoLabel', label: 'Actualizado', sortable: true },
];

const ROW_ACTIONS: DataAction[] = [{ id: 'open', label: 'Abrir expediente' }];
const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'abierto', label: 'Abiertos' },
  { id: 'en_seguimiento', label: 'En seguimiento' },
  { id: 'prioritarios', label: 'Prioritarios' },
  { id: 'cerrado', label: 'Cerrados' },
];

const DATE_FMT = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_FMT.format(date);
}

/**
 * Pantalla principal de Expedientes (`RF-03`, `RF-04`, `RF-34`, `RF-22`):
 * - La tabla operativa y filtros rápidos ocupan el plano principal desde el primer vistazo.
 * - La verificación previa por CURP (duplicados y precarga móvil) vive en un diálogo
 *   accionado desde `+ Nuevo expediente` para roles autorizados.
 */
export default function ExpedientesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useExpedientes();
  const { mutate: registerConsult } = useRegisterConsult();

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todos');
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [selected, setSelected] = useState<ExpedienteResumen | null>(null);
  const [preloadedDraft, setPreloadedDraft] = useState<PreRegistroMovil | null>(null);

  const canCreateExpediente = user ? canLookupPreRegistro(user.role) : false;

  function handleStartFicha(seed: FichaSeedContext) {
    navigate('/expedientes/nuevo', { state: seed });
  }

  const byId = useMemo(() => {
    const map = new Map<string, ExpedienteResumen>();
    for (const item of data ?? []) map.set(item.id, item);
    return map;
  }, [data]);

  const counts = useMemo<Record<QuickFilter, number>>(() => {
    const list = data ?? [];
    return {
      todos: list.length,
      abierto: list.filter((e) => e.estado === 'abierto').length,
      en_seguimiento: list.filter((e) => e.estado === 'en_seguimiento').length,
      prioritarios: list.filter((e) => e.enListaUrgencias).length,
      cerrado: list.filter((e) => e.estado === 'cerrado').length,
    };
  }, [data]);

  const filteredItems = useMemo(() => {
    const list = data ?? [];
    if (quickFilter === 'todos') return list;
    if (quickFilter === 'prioritarios') return list.filter((e) => e.enListaUrgencias);
    return list.filter((e) => e.estado === quickFilter);
  }, [data, quickFilter]);

  const rows: ExpedienteRow[] = useMemo(
    () =>
      filteredItems.map((item) => ({
        id: item.id,
        folio: item.folio,
        nombreCompleto: item.persona.nombreCompleto,
        curp: item.persona.curp,
        estado: ESTADO_FICHA_LABELS[item.estado],
        urgencia: item.enListaUrgencias ? 'Prioritario' : 'Normal',
        actualizadoLabel: formatDate(item.actualizadoEn),
      })),
    [filteredItems],
  );

  const commandItems: CommandItem[] = useMemo(
    () =>
      (data ?? []).map((item) => ({
        id: item.id,
        label: `${item.folio} · ${item.persona.nombreCompleto}`,
        group: ESTADO_FICHA_LABELS[item.estado],
        hint: item.persona.curp,
        keywords: [item.folio, item.persona.curp, item.persona.nombreCompleto],
      })),
    [data],
  );

  function openExpediente(expediente: ExpedienteResumen) {
    setSelected(expediente);
    registerConsult(expediente.id);
  }

  function handleCommandSelect(item: CommandItem) {
    const match = byId.get(item.id);
    if (match) openExpediente(match);
  }

  function handleRowAction(action: string, row: ExpedienteRow) {
    if (action !== 'open') return;
    const match = byId.get(row.id);
    if (match) openExpediente(match);
  }

  return (
    <>
      <PageHeader
        eyebrow="Secretaría de las Mujeres · Ahome · Expedientes"
        title="Expedientes"
        subtitle="Historial activo por folio, CURP o nombre completo."
        actions={
          <>
            <CommandSearch
              items={commandItems}
              label="Salto rápido a expediente"
              placeholder="Ir a expediente (folio, CURP o nombre)…"
              emptyLabel="Sin expedientes coincidentes."
              onSelect={handleCommandSelect}
            />
            {canCreateExpediente ? (
              <button
                type="button"
                className="mk-button mk-button--filled"
                onClick={() => setVerifyOpen(true)}
              >
                <Icon name="person_add" />
                <span className="ml-2">Nuevo expediente</span>
              </button>
            ) : null}
          </>
        }
      />

      {preloadedDraft ? (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-container/35 px-4 py-3 text-sm text-on-surface"
        >
          <div className="flex items-center gap-2">
            <Icon name="assignment_turned_in" className="text-primary" />
            <span>
              Precarga móvil confirmada para Ficha Única:{' '}
              <strong>{preloadedDraft.nombreCompleto}</strong> (
              <span className="font-mono">{preloadedDraft.curp}</span>)
            </span>
          </div>
          <button
            type="button"
            className="mk-button mk-button--text mk-button--sm"
            onClick={() => setPreloadedDraft(null)}
          >
            Limpiar
          </button>
        </div>
      ) : null}

      <div role="group" aria-label="Filtros rápidos de expedientes" className="mb-4 flex flex-wrap gap-2">
        {QUICK_FILTERS.map((f) => {
          const active = quickFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              onClick={() => setQuickFilter(f.id)}
              className={`mk-chip mk-chip--filter ${
                active ? 'bg-secondary-container text-on-secondary-container' : ''
              }`}
            >
              <span>{f.label}</span>
              <span className="ml-1.5 font-mono text-xs opacity-75">{counts[f.id]}</span>
            </button>
          );
        })}
      </div>

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudieron cargar los expedientes"
            description="Verifica tu conexión y permisos en Supabase."
            actions={RETRY_ACTION}
            onAction={() => refetch()}
          />
        </div>
      ) : (
        <Skeleton loading={isLoading} shape="card" lines={6} label="Cargando expedientes">
          <DataTable<ExpedienteRow>
            caption="Listado de expedientes activos"
            rows={rows}
            columns={COLUMNS}
            actions={ROW_ACTIONS}
            onAction={handleRowAction}
            pageSize={10}
            search="Buscar por folio, CURP o nombre…"
            emptyTitle="Sin expedientes en esta vista"
            emptyDescription={
              canCreateExpediente
                ? 'Usa «Nuevo expediente» arriba para verificar una CURP o confirmar un pre-registro móvil.'
                : 'No hay expedientes activos que coincidan con el filtro seleccionado.'
            }
          />
        </Skeleton>
      )}

      {canCreateExpediente ? (
        <VerificarCurpDialog
          open={verifyOpen}
          onOpenChange={setVerifyOpen}
          allowPreRegistroLookup={canCreateExpediente}
          onOpenExpediente={openExpediente}
          onPreloadConfirmed={setPreloadedDraft}
          onStartFicha={handleStartFicha}
        />
      ) : null}

      <FichaDetalleDialog
        expediente={selected}
        canManage={canCreateExpediente}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
