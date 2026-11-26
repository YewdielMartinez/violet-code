import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_DOMICILIO_INPUT } from '@/domain/models/Domicilio';
import { INITIAL_ESTUDIO_INPUT } from '@/domain/models/EstudioSocioeconomico';
import { INITIAL_FICHA_IDENTIDAD } from '@/domain/models/FichaRegistro';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../client', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { supabaseFichaRepository } from './SupabaseFichaRepository';

function createTableChain(singleResult?: { data: unknown; error: unknown }) {
  const chain = {
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(singleResult ?? { data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve(singleResult ?? { data: null, error: null })),
    then: (resolve: (val: { data: unknown; error: unknown }) => void) =>
      Promise.resolve(resolve(singleResult ?? { data: null, error: null })),
  };
  return chain;
}

describe('supabaseFichaRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('crea persona, ficha_registro con folio automático, servicios, domicilio y estudio', async () => {
    const personaChain = createTableChain({ data: { id: 'per-1' }, error: null });
    const fichaChain = createTableChain({
      data: { id: 'ficha-1', folio: 'SEM-2026-0007' },
      error: null,
    });
    const serviciosChain = createTableChain({ data: null, error: null });
    const domChain = createTableChain({ data: null, error: null });
    const estChain = createTableChain({ data: { id: 'est-1' }, error: null });
    const apChain = createTableChain({ data: null, error: null });

    fromMock.mockImplementation((table: string) => {
      switch (table) {
        case 'persona':
          return personaChain;
        case 'ficha_registro':
          return fichaChain;
        case 'ficha_servicio_solicitado':
          return serviciosChain;
        case 'domicilio':
          return domChain;
        case 'estudio_socioeconomico':
          return estChain;
        default:
          return apChain;
      }
    });

    const created = await supabaseFichaRepository.createComplete({
      identidad: {
        ...INITIAL_FICHA_IDENTIDAD,
        curp: 'GALA900512MSLNRR01',
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
      },
    });

    expect(created).toEqual({
      fichaId: 'ficha-1',
      folio: 'SEM-2026-0007',
      personaId: 'per-1',
    });
    expect(domChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        asentamiento_id: 12,
        codigo_postal: null,
        es_actual: true,
      }),
    );
  });

  it('archiva y desactiva lógicamente sin ejecutar borrados físicos', async () => {
    const fichaChain = createTableChain({ data: null, error: null });
    fromMock.mockReturnValue(fichaChain);

    await supabaseFichaRepository.archive('ficha-1');
    expect(fichaChain.update).toHaveBeenCalledWith({ estado: 'archivado' });

    await supabaseFichaRepository.deactivate('ficha-1');
    expect(fichaChain.update).toHaveBeenCalledWith({ activo: false });
  });
});
