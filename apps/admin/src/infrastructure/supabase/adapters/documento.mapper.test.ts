import { describe, expect, it } from 'vitest';
import {
  mapDocumentoRow,
  mapOrdenProteccionOpcion,
  mapTipoDocumentoRow,
  traducirErrorDocumento,
} from './documento.mapper';

describe('documento.mapper', () => {
  it('traduce filas snake_case de documento con cat_tipo_documento a DocumentoAdjunto camelCase', () => {
    const mapped = mapDocumentoRow({
      id: 'doc-1',
      ficha_id: 'ficha-10',
      tipo_documento_id: 1,
      orden_proteccion_id: 'ord-2',
      descripcion: 'Anverso y reverso',
      ruta_storage: 'ficha-10/uuid-ine.jpg',
      nombre_archivo: 'INE.jpg',
      activo: true,
      creado_en: '2026-11-25T18:30:00Z',
      cat_tipo_documento: { id: 1, clave: 'ine', nombre: 'Copia de la INE' },
    });

    expect(mapped).toEqual({
      id: 'doc-1',
      fichaId: 'ficha-10',
      tipoDocumentoId: 1,
      tipoDocumentoClave: 'ine',
      tipoDocumentoNombre: 'Copia de la INE',
      ordenProteccionId: 'ord-2',
      descripcion: 'Anverso y reverso',
      rutaStorage: 'ficha-10/uuid-ine.jpg',
      nombreArchivo: 'INE.jpg',
      activo: true,
      creadoEn: '2026-11-25T18:30:00Z',
    });
  });

  it('soporta relación cat_tipo_documento como arreglo o nula', () => {
    const fromArray = mapDocumentoRow({
      id: 'doc-2',
      ficha_id: 'ficha-10',
      tipo_documento_id: 9,
      orden_proteccion_id: null,
      descripcion: 'Carta de canalización',
      ruta_storage: 'ficha-10/uuid-carta.pdf',
      nombre_archivo: 'carta.pdf',
      activo: true,
      creado_en: '2026-11-25T19:00:00Z',
      cat_tipo_documento: [{ id: 9, clave: 'otro', nombre: 'Otro' }],
    });

    expect(fromArray.tipoDocumentoClave).toBe('otro');
    expect(fromArray.tipoDocumentoNombre).toBe('Otro');
    expect(fromArray.ordenProteccionId).toBeNull();

    const fromNull = mapDocumentoRow({
      id: 'doc-3',
      ficha_id: 'ficha-10',
      tipo_documento_id: 2,
      orden_proteccion_id: null,
      descripcion: null,
      ruta_storage: 'ficha-10/uuid-foto.png',
      nombre_archivo: 'foto.png',
      activo: true,
      creado_en: '2026-11-25T19:05:00Z',
      cat_tipo_documento: null,
    });

    expect(fromNull.tipoDocumentoNombre).toBe('Documento');
  });

  it('mapea cat_tipo_documento y orden_proteccion a opciones legibles', () => {
    expect(mapTipoDocumentoRow({ id: 6, clave: 'denuncia', nombre: 'Copia de la denuncia' })).toEqual({
      id: 6,
      clave: 'denuncia',
      nombre: 'Copia de la denuncia',
    });

    expect(
      mapOrdenProteccionOpcion({
        id: 'ord-1',
        numero_oficio: 'OP-2026-014',
        estado: 'vigente',
        fecha_emision: '2026-11-20',
        autoridad_emisora: 'FGE Sinaloa',
      }),
    ).toEqual({
      id: 'ord-1',
      label: 'Oficio OP-2026-014 · Vigente · 2026-11-20',
    });

    expect(
      mapOrdenProteccionOpcion({
        id: 'ord-2',
        numero_oficio: null,
        estado: 'en_tramite',
        fecha_emision: '2026-11-24',
        autoridad_emisora: null,
      }),
    ).toEqual({
      id: 'ord-2',
      label: 'Orden sin oficio · En trámite · 2026-11-24',
    });
  });

  it('traduce códigos RLS y PostgreSQL a mensajes en español', () => {
    expect(traducirErrorDocumento({ code: '42501' }, 'Error genérico').message).toContain(
      'No tienes permisos',
    );
    expect(traducirErrorDocumento({ code: '23505' }, 'Error genérico').message).toContain(
      'ya fue registrado',
    );
    expect(traducirErrorDocumento({ code: '23503' }, 'Error genérico').message).toContain(
      'Referencia inválida',
    );
    expect(traducirErrorDocumento({ code: 'P0001', message: 'Regla de negocio' }, 'Error').message).toBe(
      'Regla de negocio',
    );
  });
});
