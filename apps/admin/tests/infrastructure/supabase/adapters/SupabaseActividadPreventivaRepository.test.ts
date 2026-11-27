import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { supabaseActividadPreventivaRepository } from '@/infrastructure/supabase/adapters/SupabaseActividadPreventivaRepository';

describe('supabaseActividadPreventivaRepository', () => {
  beforeEach(() => {
    rpcMock.mockReset();
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
        },
      ],
      error: null,
    });

    const rows = await supabaseActividadPreventivaRepository.list({
      desde: '2026-11-01T00:00:00Z',
      hasta: '2026-12-31T23:59:59Z',
      limite: 50,
    });

    expect(rpcMock).toHaveBeenCalledWith('get_actividades_preventivas', {
      p_desde: '2026-11-01T00:00:00Z',
      p_hasta: '2026-12-31T23:59:59Z',
      p_limite: 50,
    });
    expect(rows[0]).toMatchObject({
      id: 'act-1',
      asentamientoNombre: 'Centro',
      codigoPostal: '81200',
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
});
