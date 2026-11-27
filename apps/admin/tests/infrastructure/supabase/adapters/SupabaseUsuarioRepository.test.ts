import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock, getSessionMock, signUpMock, signOutMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  getSessionMock: vi.fn(),
  signUpMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    auth: { getSession: getSessionMock },
  },
  createIsolatedAuthClient: () => ({ auth: { signUp: signUpMock, signOut: signOutMock } }),
}));

import { supabaseUsuarioRepository } from '@/infrastructure/supabase/adapters/SupabaseUsuarioRepository';
import { UsuarioError } from '@/domain/ports/UsuarioRepository';

type Result = { data: unknown; error: unknown };

function buildQueryMock(result: Result) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (val: Result) => void) => Promise.resolve(resolve(result)),
  };
  return chain;
}

const EMPLEADO_ROW = {
  id: 'u-2',
  nombre: 'Beatriz Ruiz',
  rol: 'trabajo_social',
  area_id: 1,
  activo: true,
  creado_en: '2026-11-20T10:00:00Z',
  actualizado_en: '2026-11-20T10:00:00Z',
  cat_area: { nombre: 'Trabajo Social' },
};

describe('supabaseUsuarioRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    getSessionMock.mockReset();
    signUpMock.mockReset();
    signOutMock.mockReset().mockResolvedValue({ error: null });
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'admin-1' } } } });
    rpcMock.mockResolvedValue({ data: true, error: null });
  });

  it('lista personal y cuentas externas ordenados por nombre', async () => {
    fromMock.mockImplementation((table: string) =>
      table === 'empleado'
        ? buildQueryMock({ data: [EMPLEADO_ROW], error: null })
        : buildQueryMock({
            data: [
              {
                id: 'x-1',
                nombre: 'Alma UMECA',
                dependencia: 'umeca',
                activo: false,
                creado_en: '2026-11-01T00:00:00Z',
                actualizado_en: '2026-11-01T00:00:00Z',
              },
            ],
            error: null,
          }),
    );

    const cuentas = await supabaseUsuarioRepository.listar();

    expect(cuentas.map((c) => [c.nombre, c.tipo, c.rol, c.areaNombre, c.activo])).toEqual([
      ['Alma UMECA', 'externo', 'umeca', 'UMECA', false],
      ['Beatriz Ruiz', 'empleado', 'trabajo_social', 'Trabajo Social', true],
    ]);
  });

  it('crea la credencial con signUp aislado y el perfil en empleado con su área', async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: 'u-2', identities: [{ id: 'i' }] }, session: { access_token: 't' } },
      error: null,
    });
    const areaQuery = buildQueryMock({ data: { id: 1 }, error: null });
    const insertQuery = buildQueryMock({ data: EMPLEADO_ROW, error: null });
    fromMock.mockImplementation((table: string) => (table === 'cat_area' ? areaQuery : insertQuery));

    const cuenta = await supabaseUsuarioRepository.crear({
      nombre: ' Beatriz Ruiz ',
      correo: 'Beatriz@Semujeres.gob.mx',
      contrasena: 'Temporal2026',
      rol: 'trabajo_social',
    });

    expect(rpcMock).toHaveBeenCalledWith('tiene_permiso', { p_permiso: 'cuentas.gestionar' });
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'beatriz@semujeres.gob.mx', password: 'Temporal2026' }),
    );
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' });
    expect(areaQuery.eq).toHaveBeenCalledWith('clave', 'trabajo_social');
    expect(insertQuery.insert).toHaveBeenCalledWith({
      id: 'u-2',
      nombre: 'Beatriz Ruiz',
      rol: 'trabajo_social',
      area_id: 1,
      creado_por: 'admin-1',
    });
    expect(cuenta).toMatchObject({ id: 'u-2', tipo: 'empleado', areaNombre: 'Trabajo Social' });
  });

  it('crea cuentas UMECA en usuario_externo', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'x-9', identities: [{}] }, session: null }, error: null });
    const insertQuery = buildQueryMock({
      data: {
        id: 'x-9',
        nombre: 'Carla',
        dependencia: 'umeca',
        activo: true,
        creado_en: '2026-11-27T00:00:00Z',
        actualizado_en: '2026-11-27T00:00:00Z',
      },
      error: null,
    });
    fromMock.mockReturnValue(insertQuery);

    const cuenta = await supabaseUsuarioRepository.crear({
      nombre: 'Carla',
      correo: 'carla@umeca.gob.mx',
      contrasena: 'Temporal2026',
      rol: 'umeca',
    });

    expect(fromMock).toHaveBeenCalledWith('usuario_externo');
    expect(insertQuery.insert).toHaveBeenCalledWith({
      id: 'x-9',
      nombre: 'Carla',
      dependencia: 'umeca',
      creado_por: 'admin-1',
    });
    expect(cuenta.tipo).toBe('externo');
  });

  it('no llama a signUp si no se tiene cuentas.gestionar', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });

    await expect(
      supabaseUsuarioRepository.crear({ nombre: 'X', correo: 'x@x.mx', contrasena: 'Temporal2026', rol: 'recepcion' }),
    ).rejects.toMatchObject({ code: 'permiso' });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('detecta correo ya registrado (usuario sin identidades)', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'fake', identities: [] }, session: null }, error: null });

    const promise = supabaseUsuarioRepository.crear({
      nombre: 'X',
      correo: 'x@x.mx',
      contrasena: 'Temporal2026',
      rol: 'recepcion',
    });
    await expect(promise).rejects.toBeInstanceOf(UsuarioError);
    await expect(promise).rejects.toMatchObject({ code: 'correo_duplicado' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('actualiza rol y área de un empleado', async () => {
    const areaQuery = buildQueryMock({ data: { id: 3 }, error: null });
    const updateQuery = buildQueryMock({
      data: { ...EMPLEADO_ROW, rol: 'juridico', area_id: 3, cat_area: { nombre: 'Jurídico' } },
      error: null,
    });
    fromMock.mockImplementation((table: string) => (table === 'cat_area' ? areaQuery : updateQuery));

    const cuenta = await supabaseUsuarioRepository.actualizar(
      {
        id: 'u-2',
        tipo: 'empleado',
        nombre: 'Beatriz Ruiz',
        rol: 'trabajo_social',
        areaId: 1,
        areaNombre: 'Trabajo Social',
        activo: true,
        creadoEn: '',
        actualizadoEn: '',
      },
      { nombre: 'Beatriz Ruiz', rol: 'juridico', activo: true },
    );

    expect(updateQuery.update).toHaveBeenCalledWith({ nombre: 'Beatriz Ruiz', rol: 'juridico', area_id: 3, activo: true });
    expect(updateQuery.eq).toHaveBeenCalledWith('id', 'u-2');
    expect(cuenta.areaNombre).toBe('Jurídico');
  });

  it('quita el área al pasar a un rol sin área', async () => {
    const updateQuery = buildQueryMock({ data: { ...EMPLEADO_ROW, rol: 'recepcion', area_id: null, cat_area: null }, error: null });
    fromMock.mockReturnValue(updateQuery);

    await supabaseUsuarioRepository.actualizar(
      {
        id: 'u-2',
        tipo: 'empleado',
        nombre: 'Beatriz Ruiz',
        rol: 'trabajo_social',
        areaId: 1,
        areaNombre: 'Trabajo Social',
        activo: true,
        creadoEn: '',
        actualizadoEn: '',
      },
      { nombre: 'Beatriz Ruiz', rol: 'recepcion', activo: true },
    );

    expect(fromMock).not.toHaveBeenCalledWith('cat_area');
    expect(updateQuery.update).toHaveBeenCalledWith({ nombre: 'Beatriz Ruiz', rol: 'recepcion', area_id: null, activo: true });
  });
});
