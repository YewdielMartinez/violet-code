import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, storageFromMock, uploadMock, removeMock, createSignedUrlMock, getPublicUrlMock } =
  vi.hoisted(() => ({
    fromMock: vi.fn(),
    storageFromMock: vi.fn(),
    uploadMock: vi.fn(),
    removeMock: vi.fn(),
    createSignedUrlMock: vi.fn(),
    getPublicUrlMock: vi.fn(),
  }));

vi.mock('../client', () => ({
  supabase: {
    from: fromMock,
    storage: {
      from: storageFromMock,
    },
  },
}));

import { supabaseDocumentoStorageRepository } from './SupabaseDocumentoStorageRepository';

function buildTableMock(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (val: { data: unknown; error: unknown }) => void) =>
      Promise.resolve(resolve(result)),
  };
  return chain;
}

describe('supabaseDocumentoStorageRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
    storageFromMock.mockReset();
    uploadMock.mockReset();
    removeMock.mockReset();
    createSignedUrlMock.mockReset();
    getPublicUrlMock.mockReset();

    storageFromMock.mockReturnValue({
      upload: uploadMock,
      remove: removeMock,
      createSignedUrl: createSignedUrlMock,
      getPublicUrl: getPublicUrlMock,
    });
  });

  it('sube al bucket privado documentos sin sobrescribir y registra metadatos en documento', async () => {
    uploadMock.mockResolvedValue({ data: { path: 'ficha-1/abc-ine.jpg' }, error: null });
    const insertChain = buildTableMock({
      data: {
        id: 'doc-99',
        ficha_id: 'ficha-1',
        tipo_documento_id: 1,
        orden_proteccion_id: null,
        descripcion: 'Copia legible',
        ruta_storage: 'ficha-1/abc-ine.jpg',
        nombre_archivo: 'INE María.jpg',
        activo: true,
        creado_en: '2026-11-25T20:00:00Z',
        cat_tipo_documento: { id: 1, clave: 'ine', nombre: 'Copia de la INE' },
      },
      error: null,
    });
    fromMock.mockReturnValue(insertChain);

    const file = new File(['contenido'], 'INE María.jpg', { type: 'image/jpeg' });
    const progressCalls: number[] = [];

    const created = await supabaseDocumentoStorageRepository.subir(
      {
        fichaId: 'ficha-1',
        tipoDocumentoId: 1,
        descripcion: ' Copia legible ',
        file,
      },
      (pct) => progressCalls.push(pct),
    );

    expect(storageFromMock).toHaveBeenCalledWith('documentos');
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^ficha-1\/[0-9a-f-]+-ine-maria\.jpg$/),
      file,
      { contentType: 'image/jpeg', upsert: false },
    );
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        ficha_id: 'ficha-1',
        tipo_documento_id: 1,
        orden_proteccion_id: null,
        descripcion: 'Copia legible',
        nombre_archivo: 'INE María.jpg',
      }),
    );
    expect(progressCalls).toEqual([15, 70, 100]);
    expect(created.tipoDocumentoClave).toBe('ine');
  });

  it('intenta limpiar el objeto en Storage (best effort) y relanza el error si falla el insert en documento', async () => {
    uploadMock.mockResolvedValue({ data: { path: 'ficha-1/uuid-doc.pdf' }, error: null });
    removeMock.mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue(
      buildTableMock({ data: null, error: { code: '42501', message: 'RLS denied' } }),
    );

    const file = new File(['pdf'], 'denuncia.pdf', { type: 'application/pdf' });

    await expect(
      supabaseDocumentoStorageRepository.subir({
        fichaId: 'ficha-1',
        tipoDocumentoId: 6,
        file,
      }),
    ).rejects.toThrow('No tienes permisos');

    expect(removeMock).toHaveBeenCalledWith([
      expect.stringMatching(/^ficha-1\/[0-9a-f-]+-denuncia\.pdf$/),
    ]);
  });

  it('genera URLs firmadas temporales (60 s por defecto) y nunca usa getPublicUrl', async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: 'https://supabase.local/storage/v1/object/sign/documentos/x?token=abc' },
      error: null,
    });

    const url = await supabaseDocumentoStorageRepository.obtenerUrlFirmada('ficha-1/uuid-ine.jpg');

    expect(createSignedUrlMock).toHaveBeenCalledWith('ficha-1/uuid-ine.jpg', 60, undefined);
    expect(getPublicUrlMock).not.toHaveBeenCalled();
    expect(url).toContain('token=abc');
  });

  it('archiva documentos mediante update activo=false (nunca delete)', async () => {
    const updateChain = buildTableMock({ data: null, error: null });
    fromMock.mockReturnValue(updateChain);

    await supabaseDocumentoStorageRepository.archivar('doc-42');

    expect(fromMock).toHaveBeenCalledWith('documento');
    expect(updateChain.update).toHaveBeenCalledWith({ activo: false });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'doc-42');
    expect(updateChain.eq).toHaveBeenCalledWith('activo', true);
  });
});
