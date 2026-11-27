import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: { rpc: rpcMock, from: fromMock },
}));

import { supabaseReporteRepository, toReporteRow } from '@/infrastructure/supabase/adapters/SupabaseReporteRepository';

describe('supabaseReporteRepository', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it('consulta get_reporte con tipo, rango, área y agrupación', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          tipo: 'citas',
          mes: '2026-03-01',
          area_id: 2,
          area: 'Psicología',
          categoria: null,
          estado: 'asistio',
          total: '7',
          personas: null,
          mujeres: null,
          hombres: null,
          metrica: null,
        },
      ],
      error: null,
    });

    const rows = await supabaseReporteRepository.getReporte({
      tipo: 'citas',
      desde: '2026-03-01',
      hasta: '2026-03-31',
      areaId: 2,
      agrupar: 'mes',
    });

    expect(rpcMock).toHaveBeenCalledWith('get_reporte', {
      p_tipo: 'citas',
      p_desde: '2026-03-01',
      p_hasta: '2026-03-31',
      p_area_id: 2,
      p_agrupar: 'mes',
    });
    expect(rows).toEqual([
      {
        tipo: 'citas',
        mes: '2026-03-01',
        areaId: 2,
        area: 'Psicología',
        categoria: null,
        estado: 'asistio',
        total: 7,
        personas: null,
        mujeres: null,
        hombres: null,
        metrica: null,
      },
    ]);
  });

  it('sin área manda undefined y agrupa por mes por defecto', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await supabaseReporteRepository.getReporte({ tipo: 'alertas', desde: '2026-03-01', hasta: '2026-03-31' });
    expect(rpcMock).toHaveBeenCalledWith('get_reporte', {
      p_tipo: 'alertas',
      p_desde: '2026-03-01',
      p_hasta: '2026-03-31',
      p_area_id: undefined,
      p_agrupar: 'mes',
    });
  });

  it('propaga el error de Supabase', async () => {
    const error = new Error('Sin permiso');
    rpcMock.mockResolvedValue({ data: null, error });
    await expect(
      supabaseReporteRepository.getReporte({ tipo: 'citas', desde: '2026-03-01', hasta: '2026-03-31' }),
    ).rejects.toBe(error);
  });

  it('normaliza bigint y numeric que llegan como texto', () => {
    const row = toReporteRow({
      tipo: 'atenciones',
      mes: null,
      area_id: 1,
      area: 'Trabajo Social',
      categoria: 'Terapia',
      estado: 'seguimiento',
      total: '12',
      personas: '5',
      mujeres: 4,
      hombres: '1',
      metrica: '4.5',
    });
    expect(row).toMatchObject({ total: 12, personas: 5, mujeres: 4, hombres: 1, metrica: 4.5 });
  });

  it('un tipo desconocido cae en atenciones', () => {
    expect(
      toReporteRow({
        tipo: 'otro',
        mes: null,
        area_id: null,
        area: null,
        categoria: null,
        estado: null,
        total: 1,
        personas: null,
        mujeres: null,
        hombres: null,
        metrica: null,
      }).tipo,
    ).toBe('atenciones');
  });

  it('lista las áreas del catálogo', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: 1, clave: 'trabajo_social', nombre: 'Trabajo Social' },
        { id: 2, clave: 'psicologia', nombre: 'Psicología' },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    const areas = await supabaseReporteRepository.listAreas();

    expect(fromMock).toHaveBeenCalledWith('cat_area');
    expect(select).toHaveBeenCalledWith('id, clave, nombre');
    expect(areas).toEqual([
      { id: 1, clave: 'trabajo_social', nombre: 'Trabajo Social' },
      { id: 2, clave: 'psicologia', nombre: 'Psicología' },
    ]);
  });
});
