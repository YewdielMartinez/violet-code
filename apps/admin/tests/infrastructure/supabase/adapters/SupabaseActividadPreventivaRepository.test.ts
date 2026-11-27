import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

import { supabaseActividadPreventivaRepository } from '@/infrastructure/supabase/adapters/SupabaseActividadPreventivaRepository';

describe('supabaseActividadPreventivaRepository', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it('lista actividades preventivas mapeando asentamiento y participantes', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'act-1',
          titulo: 'Prevención en el noviazgo',
          tipo_actividad_id: 2,
          tipo_actividad_clave: 'taller',
          tipo_actividad_nombre: 'Taller',
          tipo_institucion: 'escuela',
          nivel_educativo: 'preparatoria',
          sede: 'CBTis 43',
          direccion: 'Blvd. Jiquilpan',
          referencias: 'Auditorio',
          asentamiento_id: 5,
          asentamiento_nombre: 'Centro',
          codigo_postal: '81200',
          municipio: 'Ahome',
          programada_en: '2026-12-01T16:00:00Z',
          numero_asistentes: 80,
          creado_por: 'emp-1',
          creado_por_nombre: 'Laura TS',
          creado_en: '2026-11-26T10:00:00Z',
          participantes: [{ empleado_id: 'emp-1', nombre: 'Laura TS', rol: 'trabajo_social' }],
          estado: 'realizada',
          realizada_en: '2026-12-01T18:00:00Z',
          cancelada_motivo: null,
          observaciones_cierre: 'Muy participativos',
        },
      ],
      error: null,
    });

    const rows = await supabaseActividadPreventivaRepository.list({
      desde: '2026-11-01T00:00:00Z',
      hasta: '2026-12-31T23:59:59Z',
      estado: 'realizada',
      limite: 50,
    });

    expect(rpcMock).toHaveBeenCalledWith('get_actividades_preventivas', {
      p_desde: '2026-11-01T00:00:00Z',
      p_hasta: '2026-12-31T23:59:59Z',
      p_estado: 'realizada',
      p_limite: 50,
    });
    expect(rows[0]).toMatchObject({
      id: 'act-1',
      asentamientoNombre: 'Centro',
      codigoPostal: '81200',
      estado: 'realizada',
      realizadaEn: '2026-12-01T18:00:00Z',
      observacionesCierre: 'Muy participativos',
      participantes: [{ empleadoId: 'emp-1', nombre: 'Laura TS', rol: 'trabajo_social' }],
    });
  });

  it('registra actividad preventiva y sus participantes en una transacción', async () => {
    rpcMock.mockResolvedValue({
      data: [{ actividad_id: 'act-9', total_participantes: 2 }],
      error: null,
    });

    const result = await supabaseActividadPreventivaRepository.registrar({
      titulo: '  Jornada comunitaria  ',
      tipoActividadId: 4,
      tipoInstitucion: 'comunidad',
      sede: 'Parque Sinaloa',
      programadaEn: '2026-12-10T10:00:00Z',
      numeroAsistentes: 50,
      participantesIds: ['emp-1', 'emp-2'],
    });

    expect(rpcMock).toHaveBeenCalledWith('registrar_actividad_preventiva', {
      p_payload: {
        titulo: 'Jornada comunitaria',
        tipo_actividad_id: 4,
        tipo_institucion: 'comunidad',
        nivel_educativo: null,
        sede: 'Parque Sinaloa',
        direccion: null,
        referencias: null,
        asentamiento_id: null,
        programada_en: '2026-12-10T10:00:00Z',
        numero_asistentes: 50,
        participantes_ids: ['emp-1', 'emp-2'],
      },
    });
    expect(result).toEqual({ actividadId: 'act-9', totalParticipantes: 2 });
  });
  it('sin estado en los filtros no manda p_estado (trae todos)', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await supabaseActividadPreventivaRepository.list();
    const args = rpcMock.mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_estado).toBeUndefined();
    expect(args.p_limite).toBe(100);
  });

  it('actualiza el estado con actualizar_estado_actividad y devuelve el resultado mapeado', async () => {
    rpcMock.mockResolvedValue({
      data: [{ actividad_id: 'act-1', estado: 'realizada', realizada_en: '2026-12-03T18:00:00Z' }],
      error: null,
    });

    const result = await supabaseActividadPreventivaRepository.actualizarEstado({
      actividadId: 'act-1',
      estado: 'realizada',
      numeroAsistentes: 45,
      observaciones: ' Sin novedades ',
    });

    expect(rpcMock).toHaveBeenCalledWith('actualizar_estado_actividad', {
      p_actividad_id: 'act-1',
      p_estado: 'realizada',
      p_numero_asistentes: 45,
      p_observaciones: 'Sin novedades',
      p_motivo_cancelacion: null,
    });
    expect(result).toEqual({ actividadId: 'act-1', estado: 'realizada', realizadaEn: '2026-12-03T18:00:00Z' });
  });

  it('reabrir devuelve realizada_en nulo y acepta una fila sin arreglo', async () => {
    rpcMock.mockResolvedValue({ data: { actividad_id: 'act-1', estado: 'pendiente', realizada_en: null }, error: null });
    await expect(
      supabaseActividadPreventivaRepository.actualizarEstado({ actividadId: 'act-1', estado: 'pendiente' }),
    ).resolves.toEqual({ actividadId: 'act-1', estado: 'pendiente', realizadaEn: null });
  });

  it('propaga los errores del RPC de estado (42501, 22023, P0002) y la respuesta vacía', async () => {
    for (const code of ['42501', '22023', 'P0002']) {
      const boom = { code, message: 'x' };
      rpcMock.mockResolvedValueOnce({ data: null, error: boom });
      await expect(
        supabaseActividadPreventivaRepository.actualizarEstado({ actividadId: 'a', estado: 'cancelada' }),
      ).rejects.toBe(boom);
    }
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await expect(
      supabaseActividadPreventivaRepository.actualizarEstado({ actividadId: 'a', estado: 'cancelada' }),
    ).rejects.toThrow(/nuevo estado/);
  });

  it('lista el catálogo de tipos de actividad', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 1, clave: 'taller', nombre: 'Taller' }], error: null });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    await expect(supabaseActividadPreventivaRepository.listTipos()).resolves.toEqual([
      { id: 1, clave: 'taller', nombre: 'Taller' },
    ]);
    expect(fromMock).toHaveBeenCalledWith('cat_tipo_actividad');
    expect(order).toHaveBeenCalledWith('id');
  });

  it('lista solo empleados activos como participantes posibles y propaga errores', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'e1', nombre: 'Laura', rol: 'psicologia' }], error: null });
    const eq = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) });

    await expect(supabaseActividadPreventivaRepository.listEmpleados()).resolves.toEqual([
      { id: 'e1', nombre: 'Laura', rol: 'psicologia' },
    ]);
    expect(fromMock).toHaveBeenCalledWith('empleado');
    expect(eq).toHaveBeenCalledWith('activo', true);

    const boom = new Error('rls');
    order.mockResolvedValue({ data: null, error: boom });
    await expect(supabaseActividadPreventivaRepository.listEmpleados()).rejects.toBe(boom);
  });
});
