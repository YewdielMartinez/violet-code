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

import { supabaseDerivacionRepository } from '@/infrastructure/supabase/adapters/SupabaseDerivacionRepository';

function createChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

describe('supabaseDerivacionRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('inserta derivación interna anulando campos de institución externa', async () => {
    const chain = createChain({ data: { id: 'der-1' }, error: null });
    fromMock.mockReturnValue(chain);

    const res = await supabaseDerivacionRepository.create({
      fichaId: 'ficha-1',
      areaOrigenId: 1,
      destino: 'psicologia',
      areaDestinoId: 2,
      institucionId: 99,
      institucionOtra: 'Ignorar',
      motivo: 'Atención psicológica inicial',
    });

    expect(res).toEqual({ id: 'der-1' });
    expect(chain.insert).toHaveBeenCalledWith({
      ficha_id: 'ficha-1',
      area_origen_id: 1,
      destino: 'psicologia',
      area_destino_id: 2,
      institucion_id: null,
      institucion_otra: null,
      motivo: 'Atención psicológica inicial',
    });
  });

  it('inserta derivación externa respetando directorio vs texto libre', async () => {
    const chain = createChain({ data: { id: 'der-ext' }, error: null });
    fromMock.mockReturnValue(chain);

    await supabaseDerivacionRepository.create({
      fichaId: 'ficha-1',
      areaOrigenId: 1,
      destino: 'otra_institucion',
      areaDestinoId: 2,
      institucionId: null,
      institucionOtra: '  DIF Ahome  ',
      motivo: 'Apoyo asistencial',
    });

    expect(chain.insert).toHaveBeenCalledWith({
      ficha_id: 'ficha-1',
      area_origen_id: 1,
      destino: 'otra_institucion',
      area_destino_id: null,
      institucion_id: null,
      institucion_otra: 'DIF Ahome',
      motivo: 'Apoyo asistencial',
    });
  });

  it('consulta get_derivaciones en list y listByFicha y mapea filas a camelCase', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'der-2',
          ficha_id: 'ficha-1',
          folio: 'SEM-2026-0001',
          usuaria_nombre: 'Laura García',
          area_origen_id: 1,
          area_origen_nombre: 'Trabajo Social',
          area_destino_id: 2,
          area_destino_nombre: 'Psicología',
          institucion_id: null,
          institucion_nombre: null,
          institucion_otra: null,
          destino: 'psicologia',
          motivo: 'Seguimiento emocional',
          fecha_derivacion: '2026-11-26',
          estado: 'pendiente',
          creado_en: '2026-11-26T00:00:00Z',
        },
      ],
      error: null,
    });

    const allRows = await supabaseDerivacionRepository.list('pendiente');
    expect(rpcMock).toHaveBeenCalledWith('get_derivaciones', {
      p_estado: 'pendiente',
      p_limite: 200,
    });
    expect(allRows[0]).toMatchObject({
      id: 'der-2',
      folio: 'SEM-2026-0001',
      usuariaNombre: 'Laura García',
      areaOrigenNombre: 'Trabajo Social',
      areaDestinoNombre: 'Psicología',
    });

    await supabaseDerivacionRepository.listByFicha('ficha-1');
    expect(rpcMock).toHaveBeenCalledWith('get_derivaciones', {
      p_ficha_id: 'ficha-1',
      p_limite: 200,
    });
  });

  it('invoca cambiar_estado_derivacion en updateEstado y maneja edge case de lista vacía', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const emptyRows = await supabaseDerivacionRepository.list();
    expect(emptyRows).toEqual([]);

    rpcMock.mockResolvedValueOnce({
      data: [{ derivacion_id: 'der-2', estado: 'en_proceso', actualizado_en: '2026-11-26T01:00:00Z' }],
      error: null,
    });
    await supabaseDerivacionRepository.updateEstado('der-2', 'en_proceso');
    expect(rpcMock).toHaveBeenLastCalledWith('cambiar_estado_derivacion', {
      p_derivacion_id: 'der-2',
      p_estado: 'en_proceso',
    });
  });

  it('propaga errores de autorización (42501) y transición/regla (23514) de las RPCs', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Sin permiso para consultar derivaciones' },
    });
    await expect(supabaseDerivacionRepository.list()).rejects.toMatchObject({ code: '42501' });

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23514', message: 'Transición de estado no permitida: pendiente -> concluida' },
    });
    await expect(supabaseDerivacionRepository.updateEstado('der-2', 'concluida')).rejects.toMatchObject({
      code: '23514',
    });
  });
});
