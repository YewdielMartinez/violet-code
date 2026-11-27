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

  it('invoca actualizar_persona y actualizar_ficha con bloqueo optimista y campos sin dato', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 'per-1',
          curp: 'GORL920415MSLGRN01',
          nombres: 'Lucía Fernanda',
          apellido_paterno: 'Gómez',
          apellido_materno: null,
          sexo: 'M',
          fecha_nacimiento: '1992-04-15',
          entidad_nacimiento: 'SL',
          celular: '6689998877',
          escolaridad: 'preparatoria',
          discapacidad: null,
          grupo_etnico: null,
          religion: null,
          actualizado_en: '2026-11-27T10:05:00Z',
        },
      ],
      error: null,
    });

    const persona = await supabaseFichaRepository.actualizarPersona({
      personaId: 'per-1',
      actualizadoEn: '2026-11-27T10:00:00Z',
      nombres: ' Lucía Fernanda ',
      celular: '6689998877',
      religion: '',
    });

    expect(rpcMock).toHaveBeenCalledWith('actualizar_persona', {
      p_persona_id: 'per-1',
      p_actualizado_en: '2026-11-27T10:00:00Z',
      p_nombres: 'Lucía Fernanda',
      p_apellido_paterno: undefined,
      p_apellido_materno: undefined,
      p_celular: '6689998877',
      p_escolaridad: undefined,
      p_discapacidad: undefined,
      p_grupo_etnico: undefined,
      p_religion: '',
    });
    expect(persona.nombres).toBe('Lucía Fernanda');

    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 'ficha-1',
          folio: 'SEM-2026-0001',
          persona_id: 'per-1',
          estado: 'abierto',
          estado_civil: null,
          ocupacion_id: null,
          ocupacion_otra: null,
          tiene_trabajo: null,
          numero_hijas: 1,
          numero_hijos_hombres: 0,
          servicio_medico: 'imss',
          servicio_medico_otro: null,
          tiene_embarazo: false,
          tiene_denuncia: true,
          es_victima_delito: true,
          drogas: ['no_consume'],
          especificacion_droga: null,
          consumo_alcohol: 'no_consume',
          servicios_solicitados_area_ids: [1, 3],
          actualizado_en: '2026-11-27T10:06:00Z',
        },
      ],
      error: null,
    });

    const ficha = await supabaseFichaRepository.actualizar({
      fichaId: 'ficha-1',
      actualizadoEn: '2026-11-27T10:00:00Z',
      drogas: ['no_consume'],
      consumoAlcohol: 'no_consume',
      serviciosSolicitadosAreaIds: [1, 3],
      camposSinDato: ['tiene_trabajo'],
    });

    expect(rpcMock).toHaveBeenLastCalledWith(
      'actualizar_ficha',
      expect.objectContaining({
        p_ficha_id: 'ficha-1',
        p_actualizado_en: '2026-11-27T10:00:00Z',
        p_drogas: ['no_consume'],
        p_consumo_alcohol: 'no_consume',
        p_servicios_solicitados_area_ids: [1, 3],
        p_campos_sin_dato: ['tiene_trabajo'],
      }),
    );
    expect(ficha.serviciosSolicitadosAreaIds).toEqual([1, 3]);
    expect(ficha.tieneTrabajo).toBeNull();
  });

  it('invoca actualizar_domicilio, cambiar_prioridad_expediente y registrar_estudio_socioeconomico', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          domicilio_id: 'dom-2',
          persona_id: 'per-1',
          es_actual: true,
          actualizado_en: '2026-11-27T11:00:00Z',
        },
      ],
      error: null,
    });

    const dom = await supabaseFichaRepository.actualizarDomicilio({
      personaId: 'per-1',
      actualizadoEn: '2026-11-27T10:00:00Z',
      asentamientoId: 12,
      codigoPostal: '81200',
      calle: '  Av. Leyva ',
      zona: 'urbana',
    });

    expect(rpcMock).toHaveBeenCalledWith('actualizar_domicilio', {
      p_persona_id: 'per-1',
      p_actualizado_en: '2026-11-27T10:00:00Z',
      p_asentamiento_id: 12,
      p_codigo_postal: undefined,
      p_calle: 'Av. Leyva',
      p_numero_exterior: undefined,
      p_numero_interior: undefined,
      p_referencias: undefined,
      p_zona: 'urbana',
    });
    expect(dom.domicilioId).toBe('dom-2');

    rpcMock.mockResolvedValueOnce({
      data: [
        {
          ficha_id: 'ficha-1',
          prioridad: 'alta',
          prioridad_actualizada_en: '2026-11-27T11:05:00Z',
        },
      ],
      error: null,
    });

    const prio = await supabaseFichaRepository.cambiarPrioridad('ficha-1', 'alta');
    expect(rpcMock).toHaveBeenLastCalledWith('cambiar_prioridad_expediente', {
      p_ficha_id: 'ficha-1',
      p_prioridad: 'alta',
    });
    expect(prio.prioridad).toBe('alta');

    rpcMock.mockResolvedValueOnce({
      data: [
        {
          estudio_id: 'est-2',
          ficha_id: 'ficha-1',
          fecha_estudio: '2026-11-27',
          es_actual: true,
          fue_correccion: false,
          actualizado_en: '2026-11-27T11:10:00Z',
        },
      ],
      error: null,
    });

    const est = await supabaseFichaRepository.registrarEstudioSocioeconomico({
      fichaId: 'ficha-1',
      ingresoMensualPropio: 7500,
      numeroDependientes: 2,
      tieneApoyo: false,
      tipoVivienda: 'rentada',
      aportantes: [{ monto: 2000, frecuencia: 'quincenal' }],
    });

    expect(rpcMock).toHaveBeenLastCalledWith(
      'registrar_estudio_socioeconomico',
      expect.objectContaining({
        p_ficha_id: 'ficha-1',
        p_ingreso_mensual_propio: 7500,
        p_numero_dependientes: 2,
        p_aportantes: [
          expect.objectContaining({ nombre: null, monto: 2000, frecuencia: 'quincenal' }),
        ],
      }),
    );
    expect(est.estudioId).toBe('est-2');
    expect(est.fueCorreccion).toBe(false);
  });
});
