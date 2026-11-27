import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { supabaseOrdenProteccionRepository } from '@/infrastructure/supabase/adapters/SupabaseOrdenProteccionRepository';

function buildChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (val: { data: unknown; error: unknown }) => void) =>
      Promise.resolve(resolve(result)),
  };
  return chain;
}

const ROW = {
  id: 'ord-1',
  ficha_id: 'ficha-1',
  agresor_id: null,
  numero_oficio: 'OF-100',
  autoridad_emisora: 'Juzgado Primero',
  fecha_emision: '2026-11-26',
  fecha_vigencia: '2099-12-31',
  estado: 'vigente',
  activo: true,
  creado_en: '2026-11-26T10:00:00Z',
  actualizado_en: '2026-11-26T10:00:00Z',
};

describe('supabaseOrdenProteccionRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('lista órdenes activas por ficha y crea una orden nueva', async () => {
    fromMock.mockReturnValueOnce(buildChain({ data: [ROW], error: null }));
    const list = await supabaseOrdenProteccionRepository.listarPorFicha('ficha-1');
    expect(fromMock).toHaveBeenCalledWith('orden_proteccion');
    expect(list).toHaveLength(1);
    expect(list[0]?.vigente).toBe(true);

    fromMock.mockReturnValueOnce(buildChain({ data: ROW, error: null }));
    const created = await supabaseOrdenProteccionRepository.crear({
      fichaId: 'ficha-1',
      numeroOficio: 'OF-100',
      autoridadEmisora: 'Juzgado Primero',
      fechaEmision: '2026-11-26',
      fechaVigencia: '2099-12-31',
      estado: 'vigente',
    });
    expect(created.id).toBe('ord-1');
  });

  it('aplica bloqueo optimista en actualizar y desactivar y reporta conflicto concurrente', async () => {
    const updateChain = buildChain({ data: ROW, error: null });
    fromMock.mockReturnValueOnce(updateChain);

    await supabaseOrdenProteccionRepository.actualizar('ord-1', {
      fichaId: 'ficha-1',
      numeroOficio: 'OF-100',
      autoridadEmisora: 'Juzgado Primero',
      fechaEmision: '2026-11-26',
      fechaVigencia: '2099-12-31',
      estado: 'vigente',
      actualizadoEnEsperado: '2026-11-26T10:00:00Z',
    });
    expect(updateChain.eq).toHaveBeenCalledWith('actualizado_en', '2026-11-26T10:00:00Z');

    // Conflicto optimista (maybeSingle devuelve null sin error SQL)
    fromMock.mockReturnValueOnce(buildChain({ data: null, error: null }));
    await expect(
      supabaseOrdenProteccionRepository.actualizar('ord-1', {
        fichaId: 'ficha-1',
        numeroOficio: 'OF-100',
        autoridadEmisora: 'Juzgado Primero',
        fechaEmision: '2026-11-26',
        fechaVigencia: '2099-12-31',
        estado: 'vigente',
        actualizadoEnEsperado: '2026-11-26T09:00:00Z',
      }),
    ).rejects.toThrow(/modificada por otra compañera/i);

    const deactivateChain = buildChain({ data: { id: 'ord-1' }, error: null });
    fromMock.mockReturnValueOnce(deactivateChain);
    await supabaseOrdenProteccionRepository.desactivar('ord-1', '2026-11-26T10:00:00Z');
    expect(deactivateChain.update).toHaveBeenCalledWith({ activo: false });
  });
});
