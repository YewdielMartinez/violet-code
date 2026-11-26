import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { supabaseAlertaRepository } from '@/infrastructure/supabase/adapters/SupabaseAlertaRepository';

describe('supabaseAlertaRepository', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('consulta get_cola_alertas y mapea filas a camelCase', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          alerta_id: 'alr-1',
          origen: 'app_movil',
          prioridad: 'alta',
          estado: 'nueva',
          creado_en: '2026-11-26T10:00:00Z',
          tomada_en: null,
          atendida_por_nombre: null,
          persona_id: 'per-1',
          ficha_id: 'fic-1',
          folio: 'SEM-ALR-0001',
          nombre_completo: 'Patricia ConOrden',
          celular: '6684444444',
          tiene_orden_vigente: true,
          asentamiento_nombre: 'Centro',
        },
      ],
      error: null,
    });

    const rows = await supabaseAlertaRepository.listarCola(['nueva', 'tomada'], 50);

    expect(rpcMock).toHaveBeenCalledWith('get_cola_alertas', {
      p_estados: ['nueva', 'tomada'],
      p_limite: 50,
    });
    expect(rows[0]).toEqual({
      alertaId: 'alr-1',
      origen: 'app_movil',
      prioridad: 'alta',
      estado: 'nueva',
      creadoEn: '2026-11-26T10:00:00Z',
      tomadaEn: null,
      atendidaPorNombre: null,
      personaId: 'per-1',
      fichaId: 'fic-1',
      folio: 'SEM-ALR-0001',
      nombreCompleto: 'Patricia ConOrden',
      celular: '6684444444',
      tieneOrdenVigente: true,
      asentamientoNombre: 'Centro',
    });
  });

  it('invoca tomar_alerta y atender_alerta y maneja cola vacía', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await supabaseAlertaRepository.listarCola()).toEqual([]);

    rpcMock.mockResolvedValueOnce({
      data: [
        {
          alerta_id: 'alr-1',
          estado: 'tomada',
          tomada_en: '2026-11-26T10:05:00Z',
          atendida_en: null,
          atendida_por: 'emp-1',
        },
      ],
      error: null,
    });
    const tomada = await supabaseAlertaRepository.tomar('alr-1');
    expect(rpcMock).toHaveBeenLastCalledWith('tomar_alerta', { p_alerta_id: 'alr-1' });
    expect(tomada).toEqual({
      alertaId: 'alr-1',
      estado: 'tomada',
      tomadaEn: '2026-11-26T10:05:00Z',
      atendidaEn: null,
      atendidaPor: 'emp-1',
    });

    rpcMock.mockResolvedValueOnce({
      data: [
        {
          alerta_id: 'alr-1',
          estado: 'atendida',
          tomada_en: '2026-11-26T10:05:00Z',
          atendida_en: '2026-11-26T10:20:00Z',
          atendida_por: 'emp-1',
        },
      ],
      error: null,
    });
    const atendida = await supabaseAlertaRepository.atender('alr-1', '  Auxilio enviado  ');
    expect(rpcMock).toHaveBeenLastCalledWith('atender_alerta', {
      p_alerta_id: 'alr-1',
      p_observaciones: 'Auxilio enviado',
    });
    expect(atendida.estado).toBe('atendida');
  });

  it('propaga errores de autorización (42501), conflicto (23505) y regla (23514)', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Sin permiso para consultar la cola de alertas' },
    });
    await expect(supabaseAlertaRepository.listarCola()).rejects.toMatchObject({ code: '42501' });

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'Esta alerta ya fue tomada por otra persona' },
    });
    await expect(supabaseAlertaRepository.tomar('alr-1')).rejects.toMatchObject({ code: '23505' });

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23514', message: 'Solo se pueden concluir alertas en estado tomada' },
    });
    await expect(supabaseAlertaRepository.atender('alr-1')).rejects.toMatchObject({ code: '23514' });
  });
});
