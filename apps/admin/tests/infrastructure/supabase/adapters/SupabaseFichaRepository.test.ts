import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_DOMICILIO_INPUT } from '@/domain/models/Domicilio';
import { INITIAL_ESTUDIO_INPUT } from '@/domain/models/EstudioSocioeconomico';
import { INITIAL_FICHA_IDENTIDAD } from '@/domain/models/FichaRegistro';

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

import { supabaseFichaRepository } from '@/infrastructure/supabase/adapters/SupabaseFichaRepository';

function createTableChain(singleResult?: { data: unknown; error: unknown }) {
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    then: (resolve: (val: { data: unknown; error: unknown }) => void) =>
      Promise.resolve(resolve(singleResult ?? { data: null, error: null })),
  };
  return chain;
}

describe('supabaseFichaRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('invoca el RPC atómico crear_ficha_completa y mapea el resultado', async () => {
    rpcMock.mockResolvedValue({
      data: [{ ficha_id: 'ficha-1', folio: 'SEM-2026-0007', persona_id: 'per-1' }],
      error: null,
    });

    const created = await supabaseFichaRepository.createComplete({
      identidad: {
        ...INITIAL_FICHA_IDENTIDAD,
        curp: 'gala900512mslnrr01',
        nombres: 'Laura',
        apellidoPaterno: 'García',
        serviciosSolicitadosAreaIds: [1, 2],
        avisoPrivacidadAceptado: true,
      },
      domicilio: {
        ...INITIAL_DOMICILIO_INPUT,
        asentamientoId: 12,
        calle: 'Calle Hidalgo',
      },
      estudio: {
        ...INITIAL_ESTUDIO_INPUT,
        ingresoMensualPropio: '6000',
        servicios: ['agua', 'luz'],
      },
    });

    expect(rpcMock).toHaveBeenCalledWith('crear_ficha_completa', {
      p_payload: expect.objectContaining({
        identidad: expect.objectContaining({ curp: 'GALA900512MSLNRR01' }),
        domicilio: expect.objectContaining({ asentamientoId: 12 }),
        estudio: expect.objectContaining({ servicios: ['agua', 'luz'] }),
      }),
    });
    expect(created).toEqual({
      fichaId: 'ficha-1',
      folio: 'SEM-2026-0007',
      personaId: 'per-1',
    });
  });

  it('obtiene el detalle completo mediante get_expediente_detalle en una sola llamada', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ficha: {
          id: 'ficha-1',
          folio: 'SEM-2026-0007',
          estado: 'abierto',
          registrada_en: '2026-11-26T10:00:00Z',
          aviso_privacidad_aceptado_en: '2026-11-26T10:00:00Z',
          estado_civil: 'soltero',
          ocupacion_nombre: 'Empleada(o)',
          servicio_medico: 'imss',
          servicio_medico_otro: null,
          tiene_trabajo: true,
          numero_hijas: 1,
          numero_hijos_hombres: 0,
          tiene_embarazo: false,
          tiene_denuncia: false,
          es_victima_delito: true,
        },
        persona: {
          id: 'per-1',
          curp: 'gala900512mslnrr01',
          nombres: 'Laura',
          apellido_paterno: 'García',
          apellido_materno: 'Lara',
          sexo: 'M',
          fecha_nacimiento: '1990-05-12',
          entidad_nacimiento: 'SL',
          celular: '6681234567',
        },
        servicios_solicitados: [
          { area_id: 1, clave: 'trabajo_social', nombre: 'Trabajo Social' },
        ],
        domicilio_actual: {
          id: 'dom-1',
          asentamiento_id: 12,
          asentamiento_nombre: 'Centro',
          codigo_postal: '81200',
          calle: 'Calle Hidalgo',
          numero_exterior: '100',
          numero_interior: null,
          referencias: 'Portón azul',
          zona: 'urbana',
        },
        estudio_actual: {
          id: 'est-1',
          fecha_estudio: '2026-11-26',
          ingreso_mensual_propio: 6000,
          numero_dependientes: 1,
          tiene_apoyo: false,
          especificacion_apoyo: null,
          tipo_vivienda: 'propia',
          material: 'ladrillo',
          material_otro: null,
          servicios: ['agua', 'luz'],
          bienes: ['estufa'],
          aportantes: [
            {
              id: 'ap-1',
              nombre: 'Ana García',
              parentesco_nombre: 'Madre',
              parentesco_otro: null,
              ocupacion_nombre: null,
              ocupacion_otra: 'Comerciante',
              tipo_trabajo: 'fijo',
              monto: 3000,
              frecuencia: 'mensual',
            },
          ],
        },
      },
      error: null,
    });

    const detail = await supabaseFichaRepository.getDetail('ficha-1');

    expect(rpcMock).toHaveBeenCalledWith('get_expediente_detalle', {
      p_ficha_id: 'ficha-1',
      p_incluir_agresores: false,
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(detail).toMatchObject({
      id: 'ficha-1',
      folio: 'SEM-2026-0007',
      ocupacionNombre: 'Empleada(o)',
      serviciosSolicitados: ['Trabajo Social'],
      persona: {
        curp: 'GALA900512MSLNRR01',
        nombreCompleto: 'Laura García Lara',
      },
      domicilio: {
        asentamientoNombre: 'Centro',
        codigoPostal: '81200',
      },
      estudio: {
        servicios: ['agua', 'luz'],
        aportantes: [
          {
            id: 'ap-1',
            parentescoNombre: 'Madre',
            ocupacionNombre: 'Comerciante',
          },
        ],
      },
    });
  });

  it('devuelve null en getDetail cuando el expediente no existe (23514)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '23514', message: 'No encontrado' } });

    const detail = await supabaseFichaRepository.getDetail('ficha-404');

    expect(detail).toBeNull();
  });

  it('archiva mediante RPC archivar_ficha y desactiva lógicamente sin borrados físicos', async () => {
    rpcMock.mockResolvedValue({ data: [{ ficha_id: 'ficha-1', estado: 'archivado' }], error: null });
    const fichaChain = createTableChain({ data: null, error: null });
    fromMock.mockReturnValue(fichaChain);

    await supabaseFichaRepository.archive('ficha-1', 'Conclusión de proceso');
    expect(rpcMock).toHaveBeenCalledWith('archivar_ficha', {
      p_ficha_id: 'ficha-1',
      p_motivo: 'Conclusión de proceso',
    });

    await supabaseFichaRepository.deactivate('ficha-1');
    expect(fichaChain.update).toHaveBeenCalledWith({ activo: false });
  });
});
