import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, fromMock, channelMock, removeChannelMock, onMock, subscribeMock } = vi.hoisted(
  () => {
    const on = vi.fn();
    const subscribe = vi.fn();
    const channelObj = { on, subscribe };
    on.mockReturnValue(channelObj);
    subscribe.mockReturnValue(channelObj);

    return {
      rpcMock: vi.fn(),
      fromMock: vi.fn(),
      channelMock: vi.fn(() => channelObj),
      removeChannelMock: vi.fn(),
      onMock: on,
      subscribeMock: subscribe,
    };
  },
);

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
    channel: channelMock,
    removeChannel: removeChannelMock,
  },
}));

import { supabaseAlertaRepository } from '@/infrastructure/supabase/adapters/SupabaseAlertaRepository';

describe('supabaseAlertaRepository', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    channelMock.mockClear();
    removeChannelMock.mockReset();
    onMock.mockClear();
    subscribeMock.mockClear();
  });

  it('consulta get_cola_alertas, ordena por prioridad y fecha y mapea filas a camelCase', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          alerta_id: 'alr-media',
          origen: 'telefono',
          prioridad: 'media',
          estado: 'nueva',
          creado_en: '2026-11-26T09:00:00Z',
          tomada_en: null,
          atendida_por_nombre: null,
          persona_id: 'per-2',
          ficha_id: null,
          folio: null,
          nombre_completo: 'Lucía Media',
          celular: null,
          tiene_orden_vigente: false,
          asentamiento_nombre: 'Jardines',
        },
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
    expect(rows.map((r) => r.alertaId)).toEqual(['alr-1', 'alr-media']);
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

  it('consulta detalle complementario de la alerta y mapea atendidaEn/observaciones', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValueOnce({
      data: {
        id: 'alr-1',
        atendida_en: '2026-11-26T10:20:00Z',
        observaciones: 'Canalizada a refugio',
        actualizado_en: '2026-11-26T10:20:00Z',
      },
      error: null,
    });
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: maybeSingleMock,
    };
    fromMock.mockReturnValueOnce(chain);

    const detalle = await supabaseAlertaRepository.obtenerDetalle('alr-1');
    expect(fromMock).toHaveBeenCalledWith('alerta');
    expect(detalle).toEqual({
      alertaId: 'alr-1',
      atendidaEn: '2026-11-26T10:20:00Z',
      observaciones: 'Canalizada a refugio',
      actualizadoEn: '2026-11-26T10:20:00Z',
    });
  });

  it('encapsula la suscripción Realtime sobre public.alerta y limpia el canal al desuscribir', () => {
    const onChange = vi.fn();
    const onStatus = vi.fn();

    const unsubscribe = supabaseAlertaRepository.suscribirCambios(onChange, onStatus);

    expect(channelMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'alerta' },
      expect.any(Function),
    );
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    const changeHandler = onMock.mock.calls[0]?.[2] as (payload: unknown) => void;
    changeHandler({
      eventType: 'INSERT',
      new: { id: 'alr-99', prioridad: 'alta', estado: 'nueva', origen: 'app_movil' },
    });
    expect(onChange).toHaveBeenCalledWith({
      eventType: 'INSERT',
      alertaId: 'alr-99',
      prioridad: 'alta',
      estado: 'nueva',
      origen: 'app_movil',
    });

    const statusHandler = subscribeMock.mock.calls[0]?.[0] as (status: string) => void;
    statusHandler('SUBSCRIBED');
    expect(onStatus).toHaveBeenCalledWith('SUBSCRIBED');

    unsubscribe();
    expect(removeChannelMock).toHaveBeenCalledTimes(1);
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
