import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, getUserMock, signInMock, updateUserMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  getUserMock: vi.fn(),
  signInMock: vi.fn(),
  updateUserMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
    auth: { getUser: getUserMock, signInWithPassword: signInMock, updateUser: updateUserMock },
  },
}));

import {
  mapContrasenaActualError,
  mapContrasenaNuevaError,
  mapMiPerfilRow,
  mapPerfilRpcError,
  supabaseAuthRepository,
  type MiPerfilRow,
} from '@/infrastructure/supabase/adapters/SupabaseAuthRepository';
import { AuthError } from '@/domain/ports/AuthRepository';

const ROW: MiPerfilRow = {
  id: 'u-1',
  tipo: 'empleado',
  nombre: 'Claudia Trabajo Social',
  correo: 'ts@demo.local',
  telefono: '6671234567',
  rol: 'trabajo_social',
  area_id: 1,
  area_clave: 'trabajo_social',
  area_nombre: 'Trabajo Social',
  dependencia: null,
  activo: true,
  permisos: ['expediente.ver', 'agenda.ver'],
  creado_en: '2026-11-20T10:00:00Z',
};

describe('mapMiPerfilRow', () => {
  it('mapea snake_case a camelCase y ordena los permisos', () => {
    expect(mapMiPerfilRow(ROW)).toMatchObject({
      id: 'u-1',
      tipo: 'empleado',
      correo: 'ts@demo.local',
      telefono: '6671234567',
      rol: 'trabajo_social',
      areaNombre: 'Trabajo Social',
      activo: true,
      permisos: ['agenda.ver', 'expediente.ver'],
    });
  });

  it('tolera permisos nulos, teléfono vacío y cuenta externa', () => {
    const perfil = mapMiPerfilRow({
      ...ROW,
      tipo: 'externo',
      rol: 'umeca',
      telefono: ' ',
      permisos: null,
      dependencia: 'umeca',
    });
    expect(perfil).toMatchObject({ tipo: 'externo', rol: 'umeca', telefono: null, permisos: [], dependencia: 'umeca' });
  });
});

describe('errores', () => {
  it('traduce los códigos del RPC', () => {
    expect(mapPerfilRpcError({ code: '42501' }, 'x').status).toBe(403);
    expect(mapPerfilRpcError({ code: '23514', message: 'El teléfono debe tener 10 dígitos.' }, 'x').message).toBe(
      'El teléfono debe tener 10 dígitos.',
    );
    expect(mapPerfilRpcError(null, 'Falló').message).toBe('Falló');
  });

  it('traduce los errores de contraseña de Supabase Auth', () => {
    expect(mapContrasenaActualError(400, 'Invalid login credentials')).toBe('La contraseña actual no es correcta.');
    expect(mapContrasenaNuevaError('New password should be different from the old password.')).toMatch(/distinta/);
    expect(mapContrasenaNuevaError('Password is too weak')).toMatch(/demasiado débil/);
  });
});

describe('supabaseAuthRepository (perfil)', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    getUserMock.mockReset();
    signInMock.mockReset();
    updateUserMock.mockReset();
  });

  it('miPerfil llama a get_mi_perfil y toma la primera fila', async () => {
    rpcMock.mockResolvedValue({ data: [ROW], error: null });
    const perfil = await supabaseAuthRepository.miPerfil();
    expect(rpcMock).toHaveBeenCalledWith('get_mi_perfil');
    expect(perfil.nombre).toBe('Claudia Trabajo Social');
  });

  it('miPerfil lanza AuthError si el RPC falla o no hay fila', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'x' } });
    await expect(supabaseAuthRepository.miPerfil()).rejects.toBeInstanceOf(AuthError);
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await expect(supabaseAuthRepository.miPerfil()).rejects.toMatchObject({ status: 404 });
  });

  it('actualizarMiPerfil normaliza el teléfono y manda null si va vacío', async () => {
    rpcMock.mockResolvedValue({ data: [{ nombre: 'Ana', telefono: '6671234567' }], error: null });
    const saved = await supabaseAuthRepository.actualizarMiPerfil({ nombre: ' Ana ', telefono: '(667) 123-4567' });
    expect(rpcMock).toHaveBeenCalledWith('actualizar_mi_perfil', { p_nombre: 'Ana', p_telefono: '6671234567' });
    expect(saved).toEqual({ nombre: 'Ana', telefono: '6671234567' });

    rpcMock.mockResolvedValue({ data: [{ nombre: 'Ana', telefono: null }], error: null });
    await supabaseAuthRepository.actualizarMiPerfil({ nombre: 'Ana', telefono: '' });
    expect(rpcMock).toHaveBeenLastCalledWith('actualizar_mi_perfil', { p_nombre: 'Ana', p_telefono: null });
  });

  it('actualizarMiPerfil propaga el mensaje de validación del RPC', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '23514', message: 'El teléfono debe tener 10 dígitos.' } });
    await expect(supabaseAuthRepository.actualizarMiPerfil({ nombre: 'Ana', telefono: '1' })).rejects.toThrow(
      'El teléfono debe tener 10 dígitos.',
    );
  });

  it('cambiarContrasena re-valida la actual y luego actualiza', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'ts@demo.local' } }, error: null });
    signInMock.mockResolvedValue({ error: null });
    updateUserMock.mockResolvedValue({ error: null });
    await supabaseAuthRepository.cambiarContrasena('Vieja1234', 'Nueva1234');
    expect(signInMock).toHaveBeenCalledWith({ email: 'ts@demo.local', password: 'Vieja1234' });
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'Nueva1234' });
  });

  it('cambiarContrasena no actualiza si la actual es incorrecta', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'ts@demo.local' } }, error: null });
    signInMock.mockResolvedValue({ error: { status: 400, message: 'Invalid login credentials' } });
    await expect(supabaseAuthRepository.cambiarContrasena('mala', 'Nueva1234')).rejects.toThrow(
      'La contraseña actual no es correcta.',
    );
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('cambiarContrasena falla sin sesión', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    await expect(supabaseAuthRepository.cambiarContrasena('a', 'b')).rejects.toMatchObject({ status: 401 });
    expect(signInMock).not.toHaveBeenCalled();
  });
});
