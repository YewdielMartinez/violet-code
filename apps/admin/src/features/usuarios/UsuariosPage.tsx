import { memo, useCallback, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState, Skeleton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { VcDataTable } from '@/shared/ui/table/VcDataTable';
import { preloadPage } from '@/app/pages';
import { useAuth } from '@/shared/auth/useAuth';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ToolbarPrimaryButton } from '@/shared/ui/Toolbar';
import { ToolbarFilterMenu } from '@/shared/ui/ToolbarFilterMenu';
import {
  ESTADO_CUENTA_LABELS,
  ROLE_LABELS,
  errorMessage,
  puedeGestionarCuentas,
  useCambiarActivoUsuario,
  useUsuarios,
  type UsuarioCuenta,
} from './api';
import { UsuarioEstadoDialog } from './UsuarioEstadoDialog';
import {
  COLUMNS,
  QUICK_FILTERS,
  ROL_FILTERS,
  RETRY_ACTION,
  ROW_ACTIONS,
  USUARIOS_DECOR,
  formatTableDate,
  type UsuarioRow,
  type UsuariosQuickFilter,
  type UsuariosRolFilter,
} from './usuariosTableConfig';
import './usuarios.css';

interface TableSectionProps {
  isLoading: boolean;
  rows: UsuarioRow[];
  onRowAction: (action: string, row: UsuarioRow) => void;
  onTableClick: (event: MouseEvent<HTMLDivElement>) => void;
  onTableKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/** Aísla la tabla para que abrir el panel o cambiar filtros no re-renderice DataTable innecesariamente. */
const UsuariosTableSection = memo(function UsuariosTableSection({
  isLoading,
  rows,
  onRowAction,
  onTableClick,
  onTableKeyDown,
}: TableSectionProps) {
  return (
    <Skeleton loading={isLoading} shape="card" lines={6} label="Cargando usuarios">
      <VcDataTable<UsuarioRow>
        {...USUARIOS_DECOR}
        caption="Cuentas de acceso al panel"
        rows={rows}
        columns={COLUMNS}
        actions={ROW_ACTIONS}
        onAction={onRowAction}
        onClick={onTableClick}
        onKeyDown={onTableKeyDown}
        pageSize={10}
        search="Buscar por nombre…"
        emptyTitle="Sin cuentas en esta vista"
        emptyDescription="Usa «Nuevo usuario» arriba para dar de alta una cuenta."
      />
    </Skeleton>
  );
});

/**
 * Gestión de cuentas del panel (`cuentas.gestionar`: titular y subdirección).
 * Mismo esquema que Expedientes: tabla operativa + filtros rápidos; el alta y la edición
 * se hacen en un panel lateral escalonado con los mismos componentes que la Ficha Única.
 */
export default function UsuariosPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = puedeGestionarCuentas(user?.role);
  const { data, isLoading, isError, refetch } = useUsuarios(canManage);
  const cambiarActivo = useCambiarActivoUsuario();

  const navigate = useNavigate();
  const [estadoTarget, setEstadoTarget] = useState<UsuarioCuenta | null>(null);

  const rawFilter = searchParams.get('filtro');
  const quickFilter: UsuariosQuickFilter = QUICK_FILTERS.some((f) => f.id === rawFilter)
    ? (rawFilter as UsuariosQuickFilter)
    : 'todos';

  const rawRol = searchParams.get('rol');
  const rolFilter: UsuariosRolFilter = ROL_FILTERS.some((f) => f.id === rawRol) ? (rawRol as UsuariosRolFilter) : 'todos';

  const setRolFilter = useCallback(
    (next: UsuariosRolFilter) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === 'todos') params.delete('rol');
          else params.set('rol', next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setQuickFilter = useCallback(
    (next: UsuariosQuickFilter) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === 'todos') params.delete('filtro');
          else params.set('filtro', next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const byId = useMemo(() => {
    const map = new Map<string, UsuarioCuenta>();
    for (const item of data ?? []) map.set(item.id, item);
    return map;
  }, [data]);

  const counts = useMemo<Record<UsuariosQuickFilter, number>>(() => {
    const list = data ?? [];
    const next: Record<UsuariosQuickFilter, number> = { todos: list.length, activos: 0, inactivos: 0 };
    for (const c of list) {
      if (c.activo) next.activos++;
      else next.inactivos++;
    }
    return next;
  }, [data]);

  const rolCounts = useMemo<Record<UsuariosRolFilter, number>>(() => {
    const list = data ?? [];
    return { todos: list.length, umeca: list.filter((c) => c.rol === 'umeca').length };
  }, [data]);

  const rolOptions = useMemo(
    () => ROL_FILTERS.map((f) => ({ value: f.id, label: f.label, count: rolCounts[f.id] })),
    [rolCounts],
  );

  const filterOptions = useMemo(
    () => QUICK_FILTERS.map((f) => ({ value: f.id, label: f.label, count: counts[f.id] })),
    [counts],
  );

  const rows: UsuarioRow[] = useMemo(() => {
    const list = data ?? [];
    const porEstado =
      quickFilter === 'activos'
        ? list.filter((c) => c.activo)
        : quickFilter === 'inactivos'
          ? list.filter((c) => !c.activo)
          : list;
    const filtered = rolFilter === 'umeca' ? porEstado.filter((c) => c.rol === 'umeca') : porEstado;
    return filtered.map((c) => ({
      id: c.id,
      nombreCompleto: c.id === user?.id ? `${c.nombre} (tú)` : c.nombre,
      rol: ROLE_LABELS[c.rol],
      area: c.areaNombre ?? '—',
      estado: c.activo ? ESTADO_CUENTA_LABELS.activo : ESTADO_CUENTA_LABELS.inactivo,
      altaLabel: formatTableDate(c.creadoEn),
    }));
  }, [data, quickFilter, rolFilter, user?.id]);

  const openEditor = useCallback(
    (cuenta: UsuarioCuenta | null) => {
      const target = cuenta ? `/usuarios/${encodeURIComponent(cuenta.id)}` : '/usuarios/nuevo';
      preloadPage(target);
      navigate(target);
    },
    [navigate],
  );

  const requestToggle = useCallback(
    (cuenta: UsuarioCuenta) => {
      if (cuenta.id === user?.id) {
        toast('No puedes desactivar tu propia cuenta.', { tone: 'error' });
        return;
      }
      setEstadoTarget(cuenta);
    },
    [user?.id],
  );

  const handleRowAction = useCallback(
    (action: string, row: UsuarioRow) => {
      const match = byId.get(row.id);
      if (!match) return;
      if (action === 'edit') openEditor(match);
      else if (action === 'toggle') requestToggle(match);
    },
    [byId, openEditor, requestToggle],
  );

  const handleTableClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('button, a, input, label, [data-mk-dt-actions], [data-mk-dt-row-menu]')) return;
      if (window.getSelection()?.toString()) return;
      const rowEl = target.closest<HTMLTableRowElement>('tbody tr[data-id]');
      if (!rowEl || rowEl.hasAttribute('data-mk-dt-loading')) return;
      const match = rowEl.dataset.id ? byId.get(rowEl.dataset.id) : undefined;
      if (match) openEditor(match);
    },
    [byId, openEditor],
  );

  const handleTableKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target;
      if (
        !(target instanceof HTMLTableRowElement) ||
        !target.matches('tbody tr[data-id]') ||
        target.hasAttribute('data-mk-dt-loading')
      ) {
        return;
      }
      event.preventDefault();
      const match = target.dataset.id ? byId.get(target.dataset.id) : undefined;
      if (match) openEditor(match);
    },
    [byId, openEditor],
  );

  async function handleConfirmEstado(cuenta: UsuarioCuenta) {
    try {
      const saved = await cambiarActivo.mutateAsync({ cuenta, activo: !cuenta.activo });
      toast(saved.activo ? `Cuenta de ${saved.nombre} reactivada.` : `Cuenta de ${saved.nombre} desactivada.`);
      setEstadoTarget(null);
    } catch (err) {
      toast(errorMessage(err, 'No se pudo cambiar el estado de la cuenta.'), { tone: 'error' });
    }
  }

  if (user && !canManage) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        actions={
          <>
            <ToolbarFilterMenu
              label="Estado"
              icon="filter_list"
              options={filterOptions}
              value={quickFilter}
              defaultValue="todos"
              onChange={(v) => setQuickFilter(v as UsuariosQuickFilter)}
            />
            <ToolbarFilterMenu
              label="Rol"
              icon="badge"
              options={rolOptions}
              value={rolFilter}
              defaultValue="todos"
              onChange={(v) => setRolFilter(v as UsuariosRolFilter)}
            />
            <ToolbarPrimaryButton
              label="Nuevo usuario"
              icon="person_add"
              showLabel
              onPointerEnter={() => preloadPage('/usuarios/nuevo')}
              onFocus={() => preloadPage('/usuarios/nuevo')}
              onClick={() => openEditor(null)}
            />
          </>
        }
      />

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudieron cargar los usuarios"
            description="Verifica tu conexión y permisos en Supabase."
            actions={RETRY_ACTION}
            onAction={() => refetch()}
          />
        </div>
      ) : (
        <UsuariosTableSection
          isLoading={isLoading}
          rows={rows}
          onRowAction={handleRowAction}
          onTableClick={handleTableClick}
          onTableKeyDown={handleTableKeyDown}
        />
      )}

      <UsuarioEstadoDialog
        cuenta={estadoTarget}
        isPending={cambiarActivo.isPending}
        onOpenChange={(open) => {
          if (!open && !cambiarActivo.isPending) setEstadoTarget(null);
        }}
        onConfirm={(cuenta) => {
          void handleConfirmEstado(cuenta);
        }}
      />
    </>
  );
}
