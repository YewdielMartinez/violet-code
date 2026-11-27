import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { supabaseInformeRepository } from '@/infrastructure/supabase/adapters/SupabaseInformeRepository';

describe('supabaseInformeRepository', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('consulta informe mensual mediante get_informe', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          anio: 2026,
          mes: 11,
          area_id: 1,
          area: 'Trabajo Social',
          tipo_atencion: 'Entrevista inicial',
          primera_vez_o_seguimiento: 'primera_vez',
          mujeres: 12,
          hombres: 2,
          total_personas: 14,
          total_atenciones: 15,
        },
      ],
      error: null,
    });

    const rows = await supabaseInformeRepository.getInforme({ anio: 2026, mes: 11, areaId: 1 });

    expect(rpcMock).toHaveBeenCalledWith('get_informe', {
      p_anio: 2026,
      p_mes: 11,
      p_area_id: 1,
    });
    expect(rows).toEqual([
      {
        anio: 2026,
        mes: 11,
        areaId: 1,
        area: 'Trabajo Social',
        tipoAtencion: 'Entrevista inicial',
        primeraVezOSeguimiento: 'primera_vez',
        mujeres: 12,
        hombres: 2,
        totalPersonas: 14,
        totalAtenciones: 15,
      },
    ]);
  });

  it('consulta bitácora paginada mediante get_bitacora', async () => {
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

    const rows = await supabaseInformeRepository.getBitacora({
      tabla: '  ficha_registro ',
      limite: 50,
    });

    expect(rpcMock).toHaveBeenCalledWith('get_bitacora', {
      p_desde: undefined,
      p_hasta: undefined,
      p_tabla: 'ficha_registro',
      p_empleado_id: undefined,
      p_limite: 50,
    });
    expect(rows[0]).toMatchObject({
      id: 'bit-1',
      actorTipo: 'empleado',
      actorNombre: 'Laura TS',
      actorRol: 'trabajo_social',
    });
  });
});
