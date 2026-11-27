import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

import { supabaseAgresorRepository } from '@/infrastructure/supabase/adapters/SupabaseAgresorRepository';

function buildChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (val: { data: unknown; error: unknown }) => void) =>
      Promise.resolve(resolve(result)),
  };
  return chain;
}

describe('supabaseAgresorRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('registra consultas en bitacora_acceso para ficha_registro y agresor', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await supabaseAgresorRepository.registrarConsulta('ficha_registro', 'ficha-1');
    await supabaseAgresorRepository.registrarConsulta('agresor', 'agresor-9');

    expect(rpcMock).toHaveBeenNthCalledWith(1, 'registrar_consulta', {
      p_tabla: 'ficha_registro',
      p_registro_id: 'ficha-1',
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'registrar_consulta', {
      p_tabla: 'agresor',
      p_registro_id: 'agresor-9',
    });
  });

  it('crea, actualiza con guardar_agresor y desactiva con desactivar_agresor', async () => {
    const baseRow = {
      id: 'agresor-1',
      ficha_id: 'ficha-1',
      nombres: 'Roberto',
      apellido_paterno: null,
      apellido_materno: null,
      parentesco_id: null,
      parentesco_otro: null,
      asentamiento_id: null,
      codigo_postal: null,
      calle: null,
      numero_exterior: null,
      numero_interior: null,
      referencias: null,
      ocupacion_id: null,
      ocupacion_otra: null,
      drogas: ['no_consume'],
      especificacion_droga: null,
      especificacion_arma: null,
      observaciones: null,
      activo: true,
      actualizado_en: '2026-11-26T10:00:00Z',
    };

    rpcMock.mockResolvedValueOnce({ data: [baseRow], error: null });
    const created = await supabaseAgresorRepository.crear({
      fichaId: 'ficha-1',
      nombres: 'Roberto',
      tieneConsumoDroga: false,
    });
    expect(rpcMock).toHaveBeenCalledWith(
      'guardar_agresor',
      expect.objectContaining({
        p_ficha_id: 'ficha-1',
        p_nombres: 'Roberto',
        p_drogas: ['no_consume'],
      }),
    );
    expect(created.id).toBe('agresor-1');

    rpcMock.mockResolvedValueOnce({
      data: [{ ...baseRow, nombres: 'Roberto Editado' }],
      error: null,
    });
    const updated = await supabaseAgresorRepository.actualizar('agresor-1', {
      fichaId: 'ficha-1',
      nombres: 'Roberto Editado',
      actualizadoEnEsperado: '2026-11-26T10:00:00Z',
    });
    expect(rpcMock).toHaveBeenLastCalledWith(
      'guardar_agresor',
      expect.objectContaining({
        p_agresor_id: 'agresor-1',
        p_actualizado_en: '2026-11-26T10:00:00Z',
        p_nombres: 'Roberto Editado',
      }),
    );
    expect(updated.nombres).toBe('Roberto Editado');

    rpcMock.mockResolvedValueOnce({ data: [{ agresor_id: 'agresor-1', activo: false }], error: null });
    await supabaseAgresorRepository.desactivar('agresor-1', ' Registro duplicado ');
    expect(rpcMock).toHaveBeenLastCalledWith('desactivar_agresor', {
      p_agresor_id: 'agresor-1',
      p_motivo: 'Registro duplicado',
    });
  });

  it('propaga error 23505 de bloqueo optimista desde guardar_agresor', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: '23505',
        message: 'Este registro fue modificado por otra persona. Recarga los datos.',
      },
    });

    await expect(
      supabaseAgresorRepository.actualizar('agresor-1', {
        fichaId: 'ficha-1',
        nombres: 'Roberto',
        actualizadoEnEsperado: '2026-11-25T10:00:00Z',
      }),
    ).rejects.toThrow('Este registro fue modificado por otra persona. Recarga los datos.');
  });

  it('traduce error RLS 42501 a un mensaje seguro en español', async () => {
    fromMock.mockReturnValue(
      buildChain({ data: null, error: { code: '42501', message: 'permission denied' } }),
    );

    await expect(supabaseAgresorRepository.listarPorFicha('ficha-1')).rejects.toThrow(
      'No tienes permiso para realizar esta acción.',
    );
  });
});
