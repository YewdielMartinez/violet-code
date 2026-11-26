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

import { supabaseDashboardRepository } from '@/infrastructure/supabase/adapters/SupabaseDashboardRepository';

describe('supabaseDashboardRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('consulta actividad reciente mediante get_bitacora', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'bit-1',
          accion: 'ver',
          tabla_afectada: 'ficha_registro',
          registro_id: 'ficha-1',
          empleado_id: 'emp-1',
          usuario_externo_id: null,
          actor_tipo: 'empleado',
          actor_nombre: 'Laura TS',
          actor_rol: 'trabajo_social',
          creado_en: '2026-11-26T10:00:00Z',
        },
      ],
      error: null,
    });

    const events = await supabaseDashboardRepository.getRecentActivity(5);

    expect(rpcMock).toHaveBeenCalledWith('get_bitacora', { p_limite: 5 });
    expect(events).toEqual([
      {
        id: 'bit-1',
        creadoEn: '2026-11-26T10:00:00Z',
        accion: 'ver',
        tablaAfectada: 'ficha_registro',
        actorNombre: 'Laura TS',
        registroId: 'ficha-1',
      },
    ]);
  });

  it('consulta la cola de alertas del dashboard mediante get_cola_alertas', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          alerta_id: 'al-1',
          creado_en: '2026-11-26T09:00:00Z',
          estado: 'nueva',
          prioridad: 'alta',
          origen: 'app_movil',
          nombre_completo: 'Elena Rojas',
          asentamiento_nombre: 'Centro',
          atendida_por_nombre: null,
        },
      ],
      error: null,
    });

    const alerts = await supabaseDashboardRepository.getAlerts(undefined, 6);

    expect(rpcMock).toHaveBeenCalledWith('get_cola_alertas', {
      p_estados: ['nueva', 'tomada'],
      p_limite: 6,
    });
    expect(alerts).toEqual([
      {
        id: 'al-1',
        creadoEn: '2026-11-26T09:00:00Z',
        estado: 'nueva',
        prioridad: 'alta',
        origen: 'app_movil',
        usuariaNombre: 'Elena Rojas',
        asentamiento: 'Centro',
        atendidaPorNombre: null,
      },
    ]);
  });

  it('consulta el resumen y listado de citas mediante get_agenda', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    rpcMock.mockResolvedValue({
      data: [
        {
          cita_id: 'cita-1',
          programada_en: future,
          estado: 'agendada',
          prioridad: 'alta',
          area_id: 2,
          area_clave: 'psicologia',
          nombre_completo: 'Ana López',
          origen: 'regular',
          persona_id: 'per-1',
          reagendada_de: null,
          recomendada_por: null,
          celular: '6681112233',
        },
      ],
      error: null,
    });

    const summary = await supabaseDashboardRepository.getSchedulingSummary();
    expect(rpcMock).toHaveBeenCalledWith(
      'get_agenda',
      expect.objectContaining({
        p_estados: ['agendada', 'confirmada', 'asistio', 'no_asistio'],
        p_limite: 50,
      }),
    );
    expect(summary).toMatchObject({
      nextAt: future,
      nextArea: 'Psicología',
      nextUsuaria: 'Ana López',
    });

    const list = await supabaseDashboardRepository.getAppointments('2026-11-26', '2026-11-30');
    expect(rpcMock).toHaveBeenCalledWith('get_agenda', {
      p_desde: '2026-11-26T00:00:00',
      p_hasta: '2026-11-30T23:59:59.999',
      p_limite: 200,
    });
    expect(list[0]).toMatchObject({
      id: 'cita-1',
      areaClave: 'psicologia',
      areaNombre: 'Psicología',
      usuariaNombre: 'Ana López',
    });
  });

  it('cuenta casos con HEAD + count exact (sin descargar filas ni truncar en 300)', async () => {
    type Call = [string, ...unknown[]];
    const builders: { table: string; calls: Call[] }[] = [];
    const counts = [512, 340, 7, 301];
    fromMock.mockImplementation((table: string) => {
      const entry = { table, calls: [] as Call[] };
      const result = { data: null, error: null, count: counts[builders.length] };
      builders.push(entry);
      const builder = {
        select: (...args: unknown[]) => (entry.calls.push(['select', ...args]), builder),
        eq: (...args: unknown[]) => (entry.calls.push(['eq', ...args]), builder),
        not: (...args: unknown[]) => (entry.calls.push(['not', ...args]), builder),
        then: (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return builder;
    });

    const summary = await supabaseDashboardRepository.getCasesSummary('emp-1');

    expect(summary).toEqual({ open: 512, inFollowUp: 340, mine: 7, urgencias: 301 });
    expect(builders.map((b) => b.table)).toEqual([
      'ficha_registro',
      'ficha_registro',
      'ficha_registro',
      'vista_lista_urgencias',
    ]);
    for (const b of builders) {
      expect(b.calls[0]).toEqual(['select', expect.any(String), { count: 'exact', head: true }]);
    }
    expect(builders[0].calls).toContainEqual(['eq', 'activo', true]);
    expect(builders[0].calls).toContainEqual(['eq', 'estado', 'abierto']);
    expect(builders[1].calls).toContainEqual(['eq', 'activo', true]);
    expect(builders[1].calls).toContainEqual(['eq', 'estado', 'en_seguimiento']);
    expect(builders[2].calls).toContainEqual(['eq', 'activo', true]);
    expect(builders[2].calls).toContainEqual(['eq', 'creado_por', 'emp-1']);
    expect(builders[2].calls).toContainEqual(['not', 'estado', 'in', '(cerrado,archivado)']);
  });
});
