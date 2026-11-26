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

  it('detecta conflicto de concurrencia optimista al actualizar un registro modificado', async () => {
    const chain = buildChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    await expect(
      supabaseAgresorRepository.actualizar('agresor-1', {
        fichaId: 'ficha-1',
        nombres: 'Roberto',
        actualizadoEnEsperado: '2026-11-25T10:00:00Z',
      }),
    ).rejects.toThrow('modificado por otra compañera');

    expect(chain.eq).toHaveBeenCalledWith('actualizado_en', '2026-11-25T10:00:00Z');
  });

  it('traduce error RLS 42501 a un mensaje seguro en español', async () => {
    fromMock.mockReturnValue(
      buildChain({ data: null, error: { code: '42501', message: 'permission denied' } }),
    );

    await expect(supabaseAgresorRepository.listarPorFicha('ficha-1')).rejects.toThrow(
      'No tienes permisos para acceder o modificar datos de la persona agresora.',
    );
  });
});
