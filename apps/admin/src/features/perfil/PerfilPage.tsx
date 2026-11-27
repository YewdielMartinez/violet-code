import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { ROLE_LABELS } from '@/domain/models/Auth';
import { logout } from '@/shared/auth/session';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import { SkeletonRows } from '@/shared/ui/SkeletonRows';
import { StatusChip } from '@/shared/ui/StatusChip';
import { CardDato, CardDatos, TonalCard, TonalCardGrid } from '@/shared/ui/TonalCard';
import { useMiPerfil } from './api';

const GROUP_LABELS: Record<string, string> = {
  expediente: 'Expedientes',
  seguimiento: 'Seguimiento',
  agresor: 'Agresor',
  historial_clinico: 'Historial clínico',
  orden_proteccion: 'Órdenes de protección',
  agenda: 'Agenda',
  urgencias: 'Urgencias',
  derivacion: 'Derivaciones',
  canalizacion: 'Canalizaciones',
  alerta: 'Alertas 24/7',
  actividad: 'Actividades preventivas',
  informe: 'Informes',
  catalogos: 'Catálogos',
  directorio: 'Directorio',
  cuentas: 'Cuentas',
  bitacora: 'Bitácora',
};

function groupPermisosByPrefix(permisos: readonly string[]) {
  const groups = new Map<string, string[]>();
  for (const permiso of permisos) {
    const prefix = permiso.split('.')[0] ?? 'otros';
    const current = groups.get(prefix);
    if (current) current.push(permiso);
    else groups.set(prefix, [permiso]);
  }
  return Array.from(groups.entries()).map(([prefix, items]) => ({
    prefix,
    label: GROUP_LABELS[prefix] ?? prefix,
    items,
  }));
}

/** Pantalla de solo lectura con los datos y permisos efectivos del usuario autenticado (`#160`). */
export default function PerfilPage() {
  const navigate = useNavigate();
  const perfilQuery = useMiPerfil();
  const [signingOut, setSigningOut] = useState(false);

  const permisoGroups = useMemo(
    () => groupPermisosByPrefix(perfilQuery.data?.permisos ?? []),
    [perfilQuery.data?.permisos],
  );

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
      toast('Sesión cerrada', { tone: 'info' });
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Mi perfil"
        subtitle="Información de tu cuenta y permisos activos en el sistema"
      />

      {perfilQuery.isLoading ? (
        <SkeletonRows label="Cargando perfil" rows={4} />
      ) : perfilQuery.isError || !perfilQuery.data ? (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
          <EmptyState
            illustration="error"
            title="No se pudo cargar tu perfil"
            description="Verifica tu conexión e intenta nuevamente."
            actions={[{ id: 'retry', label: 'Reintentar' }]}
            onAction={() => void perfilQuery.refetch()}
          />
        </div>
      ) : (
        <div className="grid gap-5">
          <TonalCardGrid>
            <TonalCard title="Datos de la cuenta" wide>
              <CardDatos>
                <CardDato label="Nombre">{perfilQuery.data.displayName}</CardDato>
                <CardDato label="Correo">{perfilQuery.data.email || '—'}</CardDato>
                <CardDato label="Rol">{ROLE_LABELS[perfilQuery.data.role] ?? perfilQuery.data.role}</CardDato>
                <CardDato label={perfilQuery.data.role === 'umeca' ? 'Dependencia' : 'Área'}>
                  {perfilQuery.data.areaNombre ??
                    (perfilQuery.data.dependencia === 'umeca' ? 'UMECA' : 'Sin área asignada')}
                </CardDato>
                <CardDato label="Estado">
                  <StatusChip
                    value={perfilQuery.data.activo ? 'activo' : 'inactivo'}
                    tone={
                      perfilQuery.data.activo
                        ? 'bg-status-success-bg text-status-success'
                        : 'bg-status-danger-bg text-status-danger'
                    }
                  >
                    {perfilQuery.data.activo ? 'Activo' : 'Inactivo'}
                  </StatusChip>
                </CardDato>
              </CardDatos>
            </TonalCard>

            <TonalCard title="Permisos en el sistema" wide>
              {permisoGroups.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  Esta cuenta externa no tiene permisos internos asignados.
                </p>
              ) : (
                <div className="grid gap-3">
                  {permisoGroups.map((group) => (
                    <div key={group.prefix} className="grid gap-1.5">
                      <span className="text-xs font-medium text-on-surface-variant">{group.label}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {group.items.map((permiso) => (
                          <span
                            key={permiso}
                            className="inline-flex items-center rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-medium text-on-surface"
                          >
                            {permiso}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TonalCard>
          </TonalCardGrid>

          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-outline bg-surface px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
              disabled={signingOut}
              onClick={() => void handleLogout()}
            >
              <Icon name="logout" />
              <span>{signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
