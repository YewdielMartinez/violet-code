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

  it('archiva y desactiva lógicamente sin ejecutar borrados físicos', async () => {
    const fichaChain = createTableChain({ data: null, error: null });
    fromMock.mockReturnValue(fichaChain);

    await supabaseFichaRepository.archive('ficha-1');
    expect(fichaChain.update).toHaveBeenCalledWith({ estado: 'archivado' });

    await supabaseFichaRepository.deactivate('ficha-1');
    expect(fichaChain.update).toHaveBeenCalledWith({ activo: false });
  });
});
