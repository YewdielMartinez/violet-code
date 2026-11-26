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

import { supabaseCitaRepository } from '@/infrastructure/supabase/adapters/SupabaseCitaRepository';

function createChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

describe('supabaseCitaRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('consulta get_agenda y mapea las filas a AgendaItem', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          cita_id: 'cita-1',
          programada_en: '2099-06-15T10:00:00-07:00',
          estado: 'agendada',
          prioridad: 'alta',
          area_id: 2,
          area_clave: 'psicologia',
          recomendada_por: 'Trabajo Social',
          reagendada_de: null,
          origen: 'regular',
          persona_id: 'per-1',
          nombre_completo: 'Elena Rojas',
          celular: '6681234567',
        },
      ],
      error: null,
    });

    const rows = await supabaseCitaRepository.listarAgenda({
      desde: '2099-06-15T00:00:00-07:00',
      hasta: '2099-06-16T00:00:00-07:00',
      estados: ['agendada'],
    });

    expect(rpcMock).toHaveBeenCalledWith('get_agenda', {
      p_desde: '2099-06-15T00:00:00-07:00',
      p_hasta: '2099-06-16T00:00:00-07:00',
      p_area_id: undefined,
      p_estados: ['agendada'],
      p_limite: 200,
    });
    expect(rows[0]).toEqual({
      citaId: 'cita-1',
      programadaEn: '2099-06-15T10:00:00-07:00',
      estado: 'agendada',
      prioridad: 'alta',
      areaId: 2,
      areaClave: 'psicologia',
      recomendadaPor: 'Trabajo Social',
      reagendadaDe: null,
      origen: 'regular',
      personaId: 'per-1',
      nombreCompleto: 'Elena Rojas',
      celular: '6681234567',
    });
  });

  it('agenda cita directa en tabla y retorna el estado inicial', async () => {
    const chain = createChain({
      data: { id: 'cita-2', estado: 'agendada', programada_en: '2099-06-20T09:00:00-07:00' },
      error: null,
    });
    fromMock.mockReturnValue(chain);

    const created = await supabaseCitaRepository.crear({
      personaId: 'per-1',
      areaId: 2,
      programadaEn: '2099-06-20T09:00:00-07:00',
      prioridad: 'media',
      recomendadaPor: '  TS  ',
    });

    expect(created).toEqual({
      id: 'cita-2',
      estado: 'agendada',
      programadaEn: '2099-06-20T09:00:00-07:00',
    });
    expect(chain.insert).toHaveBeenCalledWith({
      persona_id: 'per-1',
      area_id: 2,
      programada_en: '2099-06-20T09:00:00-07:00',
      prioridad: 'media',
      recomendada_por: 'TS',
      origen: 'regular',
    });
  });

  it('invoca cambiar_estado_cita y maneja edge case de lista vacía', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const empty = await supabaseCitaRepository.listarAgenda({
      desde: '2099-06-15T00:00:00-07:00',
      hasta: '2099-06-16T00:00:00-07:00',
    });
    expect(empty).toEqual([]);

    rpcMock.mockResolvedValueOnce({
      data: [
        {
          cita_id: 'cita-1',
          estado: 'confirmada',
          confirmada_en: '2099-06-14T15:00:00Z',
        },
      ],
      error: null,
    });
    const res = await supabaseCitaRepository.cambiarEstado('cita-1', 'confirmada');
    expect(rpcMock).toHaveBeenLastCalledWith('cambiar_estado_cita', {
      p_cita_id: 'cita-1',
      p_estado: 'confirmada',
      p_motivo: undefined,
    });
    expect(res).toEqual({
      citaId: 'cita-1',
      estado: 'confirmada',
      confirmadaEn: '2099-06-14T15:00:00Z',
    });
  });

  it('propaga errores de autorización (42501) y regla/transición (23514)', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Recepción solo puede gestionar citas de Trabajo Social o Psicología' },
    });
    await expect(supabaseCitaRepository.cambiarEstado('cita-jur', 'confirmada')).rejects.toMatchObject({
      code: '42501',
    });

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23514', message: 'El rango de consulta de agenda no puede superar 31 días' },
    });
    await expect(
      supabaseCitaRepository.listarAgenda({
        desde: '2099-01-01T00:00:00-07:00',
        hasta: '2099-03-01T00:00:00-07:00',
      }),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
