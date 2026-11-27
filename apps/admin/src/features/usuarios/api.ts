import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupervisor, type StaffRole } from '@/domain/models/Auth';
import type { UsuarioCreateInput, UsuarioCuenta, UsuarioUpdateInput } from '@/domain/models/Usuario';
import { supabaseUsuarioRepository } from '@/infrastructure/supabase/adapters/SupabaseUsuarioRepository';

export * from '@/domain/models/Usuario';
export { UsuarioError } from '@/domain/ports/UsuarioRepository';

/** `cuentas.gestionar` = titular y subdirección (`es_direccion()`). */
export function puedeGestionarCuentas(role: StaffRole | undefined): boolean {
  return isSupervisor(role);
}

export function usuariosQueryOptions() {
  return queryOptions({
    queryKey: ['usuarios'],
    queryFn: () => supabaseUsuarioRepository.listar(),
    staleTime: 60_000,
  });
}

export function useUsuarios(enabled = true) {
  return useQuery({ ...usuariosQueryOptions(), enabled });
}

/** Reemplaza (o agrega) la cuenta en la caché del listado sin volver a pedir todo. */
function upsertCuenta(list: UsuarioCuenta[] | undefined, cuenta: UsuarioCuenta): UsuarioCuenta[] {
  const next = (list ?? []).filter((item) => item.id !== cuenta.id);
  next.push(cuenta);
  return next.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-MX'));
}

export function useCrearUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UsuarioCreateInput) => supabaseUsuarioRepository.crear(input),
    onSuccess: (cuenta) => {
      queryClient.setQueryData<UsuarioCuenta[]>(['usuarios'], (prev) => upsertCuenta(prev, cuenta));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useActualizarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cuenta, input }: { cuenta: UsuarioCuenta; input: UsuarioUpdateInput }) =>
      supabaseUsuarioRepository.actualizar(cuenta, input),
    onSuccess: (cuenta) => {
      queryClient.setQueryData<UsuarioCuenta[]>(['usuarios'], (prev) => upsertCuenta(prev, cuenta));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useCambiarActivoUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cuenta, activo }: { cuenta: UsuarioCuenta; activo: boolean }) =>
      supabaseUsuarioRepository.cambiarActivo(cuenta, activo),
    onSuccess: (cuenta) => {
      queryClient.setQueryData<UsuarioCuenta[]>(['usuarios'], (prev) => upsertCuenta(prev, cuenta));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message || fallback;
  }
  return fallback;
}
