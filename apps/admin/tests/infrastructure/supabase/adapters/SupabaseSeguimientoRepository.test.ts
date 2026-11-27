import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { supabaseSeguimientoRepository } from '@/infrastructure/supabase/adapters/SupabaseSeguimientoRepository';

describe('supabaseSeguimientoRepository', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('invoca registrar_seguimiento y mapea camelCase', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          atencion_id: 'at-1',
          cita_proxima_id: 'cita-2',
          es_primera_vez_area: true,
          tiene_historial_clinico: false,
        },
      ],
      error: null,
    });

    const result = await supabaseSeguimientoRepository.registrar({
      fichaId: 'ficha-1',
      citaId: 'cita-1',
      tipoAtencionId: 5,
      accionesRealizadas: '  Valoración inicial  ',
      proximaAccion: 'Seguimiento semanal',
      prioridad: 'alta',
      observaciones: 'Observación',
      proximaCitaEn: '2026-12-10T16:00:00Z',
    });

    expect(rpcMock).toHaveBeenCalledWith('registrar_seguimiento', {
      p_ficha_id: 'ficha-1',
      p_cita_id: 'cita-1',
      p_tipo_atencion_id: 5,
      p_acciones_realizadas: 'Valoración inicial',
      p_proxima_accion: 'Seguimiento semanal',
      p_prioridad: 'alta',
      p_observaciones: 'Observación',
      p_proxima_cita_en: '2026-12-10T16:00:00Z',
    });
    expect(result).toEqual({
      atencionId: 'at-1',
      folioSeguimiento: '',
      citaProximaId: 'cita-2',
      esPrimeraVezArea: true,
      tieneHistorialClinico: false,
    });
  });

  it('consulta get_linea_tiempo y preserva detalle nulo de otras áreas', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          fecha: '2026-11-26T12:00:00Z',
          tipo: 'atencion',
          area: 'Trabajo Social',
          titulo: 'Atención Trabajo Social · Entrevista inicial',
          detalle: null,
          referencia_id: 'at-1',
        },
      ],
      error: null,
    });

    const timeline = await supabaseSeguimientoRepository.getLineaTiempo('ficha-1');

    expect(rpcMock).toHaveBeenCalledWith('get_linea_tiempo', { p_ficha_id: 'ficha-1' });
    expect(timeline).toEqual([
      {
        fecha: '2026-11-26T12:00:00Z',
        tipo: 'atencion',
        area: 'Trabajo Social',
        titulo: 'Atención Trabajo Social · Entrevista inicial',
        detalle: null,
        referenciaId: 'at-1',
      },
    ]);
  });

  it('consulta get_contexto_seguimiento y corrige vía corregir_seguimiento', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          ficha_id: 'ficha-1',
          folio_expediente: 'SEM-2026-0001',
          nombre_persona: 'Lucía Álvarez',
          edad: 32,
          es_primera_vez_area: false,
          ultima_proxima_accion: 'Evaluar red de apoyo',
          tiene_orden_vigente: true,
          tiene_historial_clinico: null,
        },
      ],
      error: null,
    });

    const ctx = await supabaseSeguimientoRepository.contexto('cita-1');
    expect(rpcMock).toHaveBeenCalledWith('get_contexto_seguimiento', { p_cita_id: 'cita-1' });
    expect(ctx).toEqual({
      fichaId: 'ficha-1',
      folioExpediente: 'SEM-2026-0001',
      nombrePersona: 'Lucía Álvarez',
      edad: 32,
      esPrimeraVezArea: false,
      ultimaProximaAccion: 'Evaluar red de apoyo',
      tieneOrdenVigente: true,
      tieneHistorialClinico: null,
    });

    rpcMock.mockResolvedValueOnce({
      data: [{ atencion_id: 'at-1', actualizado_en: '2026-11-27T11:30:00Z' }],
      error: null,
    });

    const edited = await supabaseSeguimientoRepository.corregir({
      atencionId: 'at-1',
      actualizadoEn: '2026-11-27T10:00:00Z',
      accionesRealizadas: '  Nota corregida  ',
      prioridad: 'media',
    });

    expect(rpcMock).toHaveBeenLastCalledWith('corregir_seguimiento', {
      p_atencion_id: 'at-1',
      p_actualizado_en: '2026-11-27T10:00:00Z',
      p_tipo_atencion_id: undefined,
      p_acciones_realizadas: 'Nota corregida',
      p_proxima_accion: undefined,
      p_prioridad: 'media',
      p_observaciones: undefined,
    });
    expect(edited).toEqual({ atencionId: 'at-1', actualizadoEn: '2026-11-27T11:30:00Z' });
  });
});
