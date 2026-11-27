import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { supabaseHistorialClinicoRepository } from '@/infrastructure/supabase/adapters/SupabaseHistorialClinicoRepository';

describe('supabaseHistorialClinicoRepository', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('consulta get_historial_clinico y devuelve null si no existe registro', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    expect(await supabaseHistorialClinicoRepository.obtener('ficha-sin')).toBeNull();
    expect(rpcMock).toHaveBeenCalledWith('get_historial_clinico', { p_ficha_id: 'ficha-sin' });

    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 'hc-1',
          ficha_id: 'ficha-1',
          motivo_consulta: 'Ansiedad',
          antecedentes_personales: null,
          antecedentes_familiares: null,
          tiene_atencion_psicologica_previa: true,
          observaciones_iniciales: 'Primera sesión',
          creado_en: '2026-11-27T09:00:00Z',
          actualizado_en: '2026-11-27T09:00:00Z',
        },
      ],
      error: null,
    });

    const historial = await supabaseHistorialClinicoRepository.obtener('ficha-1');
    expect(historial).toEqual({
      id: 'hc-1',
      fichaId: 'ficha-1',
      motivoConsulta: 'Ansiedad',
      antecedentesPersonales: null,
      antecedentesFamiliares: null,
      tieneAtencionPsicologicaPrevia: true,
      observacionesIniciales: 'Primera sesión',
      creadoEn: '2026-11-27T09:00:00Z',
      actualizadoEn: '2026-11-27T09:00:00Z',
    });
  });

  it('guarda vía guardar_historial_clinico y traduce errores con mapSupabaseError', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 'hc-1',
          ficha_id: 'ficha-1',
          motivo_consulta: 'Motivo actualizado',
          antecedentes_personales: 'Sin antecedentes',
          antecedentes_familiares: null,
          tiene_atencion_psicologica_previa: false,
          observaciones_iniciales: null,
          actualizado_en: '2026-11-27T10:00:00Z',
        },
      ],
      error: null,
    });

    const saved = await supabaseHistorialClinicoRepository.guardar({
      fichaId: 'ficha-1',
      actualizadoEn: '2026-11-27T09:00:00Z',
      motivoConsulta: '  Motivo actualizado  ',
      antecedentesPersonales: 'Sin antecedentes',
      tieneAtencionPsicologicaPrevia: false,
      observacionesIniciales: '',
    });

    expect(rpcMock).toHaveBeenCalledWith('guardar_historial_clinico', {
      p_ficha_id: 'ficha-1',
      p_actualizado_en: '2026-11-27T09:00:00Z',
      p_motivo_consulta: 'Motivo actualizado',
      p_antecedentes_personales: 'Sin antecedentes',
      p_antecedentes_familiares: undefined,
      p_tiene_atencion_psicologica_previa: false,
      p_observaciones_iniciales: '',
    });
    expect(saved.actualizadoEn).toBe('2026-11-27T10:00:00Z');
    expect(saved.creadoEn).toBeNull();

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: '23505',
        message: 'Este registro fue modificado por otra persona. Recarga los datos.',
      },
    });

    await expect(
      supabaseHistorialClinicoRepository.guardar({
        fichaId: 'ficha-1',
        actualizadoEn: '2026-11-26T00:00:00Z',
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('lista versiones vía get_historial_clinico_versiones y las mapea', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 'ver-2',
          historial_clinico_id: 'hc-1',
          ficha_id: 'ficha-1',
          version: 2,
          antecedentes_familiares: null,
          antecedentes_personales: null,
          motivo_consulta: 'Motivo B',
          observaciones_iniciales: null,
          tiene_atencion_psicologica_previa: false,
          campos_modificados: ['observaciones_iniciales', 'motivo_consulta', 'columna_desconocida'],
          creado_por: 'emp-1',
          creado_por_nombre: ' Psicóloga Uno ',
          creado_en: '2026-11-27T11:00:00Z',
        },
      ],
      error: null,
    });

    const versiones = await supabaseHistorialClinicoRepository.versiones('ficha-1');
    expect(rpcMock).toHaveBeenCalledWith('get_historial_clinico_versiones', { p_ficha_id: 'ficha-1' });
    expect(versiones).toEqual([
      {
        id: 'ver-2',
        historialClinicoId: 'hc-1',
        fichaId: 'ficha-1',
        version: 2,
        motivoConsulta: 'Motivo B',
        antecedentesPersonales: null,
        antecedentesFamiliares: null,
        tieneAtencionPsicologicaPrevia: false,
        observacionesIniciales: null,
        camposModificados: ['motivoConsulta', 'observacionesIniciales'],
        creadoPor: 'emp-1',
        creadoPorNombre: 'Psicóloga Uno',
        creadoEn: '2026-11-27T11:00:00Z',
      },
    ]);

    rpcMock.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'x' } });
    await expect(supabaseHistorialClinicoRepository.versiones('ficha-1')).rejects.toMatchObject({
      code: '42501',
    });
  });
});
