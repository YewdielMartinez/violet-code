import { EmptyState } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { useCerrarSesion } from '@/shared/auth/useCerrarSesion';
import { SkeletonRows } from '@/shared/ui/SkeletonRows';
import { useMiPerfil } from './api';
import {
  ContactoSection,
  ContrasenaSection,
  CuentaInfoSection,
  PerfilHero,
  PermisosCard,
} from './PerfilSections';
import './perfil.css';

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

/**
 * Sección «Cuenta» de Configuración: resumen, datos de contacto (editables), datos de la cuenta,
 * cambio de contraseña, permisos y «Cerrar sesión». Pide `get_mi_perfil` solo cuando `enabled`.
 * Va dentro del cuerpo desplazable del `Dialog`: una sola columna, espaciado compacto.
 */
export function PerfilCuentaSection({ enabled = true }: { enabled?: boolean }) {
  const { data: perfil, isLoading, isError, refetch } = useMiPerfil({ enabled });
  const cerrarSesion = useCerrarSesion();

  if (isError) {
    return (
      <div className="rounded-3xl bg-surface-container-low p-6">
        <EmptyState
          illustration="error"
          title="No se pudo cargar tu perfil"
          description="Verifica tu conexión e intenta de nuevo."
          actions={RETRY_ACTION}
          onAction={() => void refetch()}
        />
      </div>
    );
  }

  if (isLoading || !perfil) {
    return <SkeletonRows label="Cargando perfil" rows={4} rowHeight="88px" />;
  }

  return (
    <div className="vc-perfil vc-sec-group grid gap-5">
      <PerfilHero perfil={perfil} />
      <ContactoSection perfil={perfil} />
      <CuentaInfoSection perfil={perfil} />
      <ContrasenaSection perfil={perfil} />
      <PermisosCard perfil={perfil} />
      <div className="vc-perfil__footer">
        <button type="button" className="mk-button mk-button--text" onClick={() => void cerrarSesion()}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
