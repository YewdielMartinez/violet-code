import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock, getSessionMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    auth: { getSession: getSessionMock },
  },
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

  it('crea la cuenta con el RPC crear_cuenta_acceso (confirmada) y lee su perfil de empleado', async () => {
    rpcMock.mockImplementation((fn: string) =>
      Promise.resolve(fn === 'crear_cuenta_acceso' ? { data: 'u-2', error: null } : { data: true, error: null }),
    );
    const perfilQuery = buildQueryMock({ data: EMPLEADO_ROW, error: null });
    fromMock.mockReturnValue(perfilQuery);

    const cuenta = await supabaseUsuarioRepository.crear({
      nombre: ' Beatriz Ruiz ',
      correo: 'Beatriz@Semujeres.gob.mx',
      contrasena: 'Temporal2026',
      rol: 'trabajo_social',
    });

    expect(rpcMock).toHaveBeenCalledWith('tiene_permiso', { p_permiso: 'cuentas.gestionar' });
    expect(rpcMock).toHaveBeenCalledWith('crear_cuenta_acceso', {
      p_correo: 'beatriz@semujeres.gob.mx',
      p_contrasena: 'Temporal2026',
      p_nombre: 'Beatriz Ruiz',
      p_rol: 'trabajo_social',
    });
    expect(fromMock).toHaveBeenCalledWith('empleado');
    expect(perfilQuery.eq).toHaveBeenCalledWith('id', 'u-2');
    expect(cuenta).toMatchObject({ id: 'u-2', tipo: 'empleado', areaNombre: 'Trabajo Social' });
  });

  it('crea cuentas UMECA y lee su perfil de usuario_externo', async () => {
    rpcMock.mockImplementation((fn: string) =>
      Promise.resolve(fn === 'crear_cuenta_acceso' ? { data: 'x-9', error: null } : { data: true, error: null }),
    );
    const perfilQuery = buildQueryMock({
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
    fromMock.mockReturnValue(perfilQuery);

    const cuenta = await supabaseUsuarioRepository.crear({
      nombre: 'Carla',
      correo: 'carla@umeca.gob.mx',
      contrasena: 'Temporal2026',
      rol: 'umeca',
    });

    expect(fromMock).toHaveBeenCalledWith('usuario_externo');
    expect(cuenta.tipo).toBe('externo');
  });

  it('no crea la cuenta si no se tiene cuentas.gestionar', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });

    await expect(
      supabaseUsuarioRepository.crear({ nombre: 'X', correo: 'x@x.mx', contrasena: 'Temporal2026', rol: 'recepcion' }),
    ).rejects.toMatchObject({ code: 'permiso' });
    expect(rpcMock).not.toHaveBeenCalledWith('crear_cuenta_acceso', expect.anything());
  });

  it('detecta correo ya registrado (23505 del RPC)', async () => {
    rpcMock.mockImplementation((fn: string) =>
      Promise.resolve(
        fn === 'crear_cuenta_acceso'
          ? { data: null, error: { code: '23505', message: 'Ya existe una cuenta con ese correo electrónico.' } }
          : { data: true, error: null },
      ),
    );

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

  it('propaga validaciones del RPC (23514) como error de acceso', async () => {
    rpcMock.mockImplementation((fn: string) =>
      Promise.resolve(
        fn === 'crear_cuenta_acceso'
          ? { data: null, error: { code: '23514', message: 'Rol no válido.' } }
          : { data: true, error: null },
      ),
    );
    await expect(
      supabaseUsuarioRepository.crear({ nombre: 'X', correo: 'x@x.mx', contrasena: 'Temporal2026', rol: 'recepcion' }),
    ).rejects.toMatchObject({ code: 'auth', message: 'Rol no válido.' });
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
