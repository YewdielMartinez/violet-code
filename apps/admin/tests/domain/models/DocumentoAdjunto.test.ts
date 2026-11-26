import { describe, expect, it } from 'vitest';
import {
  DESCRIPCION_MAX_LENGTH,
  MIME_PERMITIDOS,
  TAMANO_MAXIMO_BYTES,
  construirRutaStorage,
  esImagen,
  inferirMimeDesdeNombre,
  puedeVerDocumentos,
  sanitizarNombreArchivo,
  validarArchivo,
  validarDocumento,
} from '@/domain/models/DocumentoAdjunto';

describe('DocumentoAdjunto (reglas de dominio)', () => {
  it('expone constantes alineadas con el bucket privado documentos', () => {
    expect(MIME_PERMITIDOS).toEqual(['image/jpeg', 'image/png', 'application/pdf']);
    expect(TAMANO_MAXIMO_BYTES).toBe(10 * 1024 * 1024);
  });

  it('valida archivos permitidos (JPG, PNG y PDF dentro de 10 MB)', () => {
    expect(validarArchivo({ name: 'ine.jpg', type: 'image/jpeg', size: 1024 })).toBeNull();
    expect(validarArchivo({ name: 'foto.png', type: 'image/png', size: TAMANO_MAXIMO_BYTES })).toBeNull();
    expect(validarArchivo({ name: 'denuncia.pdf', type: 'application/pdf', size: 512_000 })).toBeNull();
  });

  it('rechaza MIME no permitidos, archivos vacíos y archivos mayores a 10 MB', () => {
    expect(validarArchivo({ name: 'script.svg', type: 'image/svg+xml', size: 500 })).toContain(
      'Tipo de archivo no permitido',
    );
    expect(validarArchivo({ name: 'doc.docx', type: 'application/msword', size: 500 })).toContain(
      'Tipo de archivo no permitido',
    );
    expect(validarArchivo({ name: 'vacio.pdf', type: 'application/pdf', size: 0 })).toContain(
      'vacío',
    );
    expect(
      validarArchivo({
        name: 'pesado.pdf',
        type: 'application/pdf',
        size: TAMANO_MAXIMO_BYTES + 1,
      }),
    ).toContain('10 MB');
    expect(validarArchivo({ name: '   ', type: 'application/pdf', size: 100 })).toContain(
      'nombre válido',
    );
  });

  it('sanitiza nombres con acentos, mayúsculas y caracteres especiales a [a-z0-9._-]', () => {
    expect(sanitizarNombreArchivo('Copia INE — María José (2026).JPG')).toBe(
      'copia-ine-maria-jose-2026.jpg',
    );
    expect(sanitizarNombreArchivo('ÑOÑO___áéíóú.PDF')).toBe('nono___aeiou.pdf');
    expect(sanitizarNombreArchivo('***...---')).toBe('archivo');
  });

  it('construye la ruta privada ${fichaId}/${uuid}-${sanitizedName}', () => {
    const ruta = construirRutaStorage(
      'ficha-123',
      'Acta de Nacimiento (Copia) ÁÉÍÓÚ.PDF',
      'uuid-456',
    );
    expect(ruta).toBe('ficha-123/uuid-456-acta-de-nacimiento-copia-aeiou.pdf');
    const [, archivoParte] = ruta.split('/');
    expect(archivoParte).toMatch(/^[a-z0-9._-]+$/);
  });

  it('respeta el límite de 500 caracteres al construir rutas muy largas conservando la extensión', () => {
    const nombreLargo = `${'a'.repeat(600)}.pdf`;
    const ruta = construirRutaStorage('ficha-1', nombreLargo, 'uuid-1');
    expect(ruta.length).toBeLessThanOrEqual(500);
    expect(ruta.endsWith('.pdf')).toBe(true);
  });

  it('identifica correctamente imágenes y tipos inferidos por nombre', () => {
    expect(esImagen('image/jpeg')).toBe(true);
    expect(esImagen('image/png')).toBe(true);
    expect(esImagen('application/pdf')).toBe(false);

    expect(inferirMimeDesdeNombre('INE.JPEG')).toBe('image/jpeg');
    expect(inferirMimeDesdeNombre('foto.png')).toBe('image/png');
    expect(inferirMimeDesdeNombre('oficio.pdf')).toBe('application/pdf');
    expect(inferirMimeDesdeNombre('sin-ext')).toBe('');
  });

  it('exige descripción cuando la clave del tipo de documento es "otro"', () => {
    const validFile = { name: 'constancia.pdf', type: 'application/pdf', size: 2048 };

    expect(
      validarDocumento({
        tipoDocumentoId: 9,
        tipoDocumentoClave: 'otro',
        descripcion: '   ',
        file: validFile,
      }),
    ).toContain('descripción es obligatoria');

    expect(
      validarDocumento({
        tipoDocumentoId: 9,
        tipoDocumentoClave: 'otro',
        descripcion: 'Constancia de estudios',
        file: validFile,
      }),
    ).toBeNull();

    expect(
      validarDocumento({
        tipoDocumentoId: 1,
        tipoDocumentoClave: 'ine',
        descripcion: '',
        file: validFile,
      }),
    ).toBeNull();

    expect(
      validarDocumento({
        tipoDocumentoId: 1,
        tipoDocumentoClave: 'ine',
        descripcion: 'x'.repeat(DESCRIPCION_MAX_LENGTH + 1),
        file: validFile,
      }),
    ).toContain(`${DESCRIPCION_MAX_LENGTH}`);

    expect(
      validarDocumento({
        tipoDocumentoId: null,
        tipoDocumentoClave: null,
        file: validFile,
      }),
    ).toContain('tipo de documento');
  });

  it('aplica los permisos de visualización de documentos alineados con expediente.ver', () => {
    expect(puedeVerDocumentos('titular')).toBe(true);
    expect(puedeVerDocumentos('subdireccion')).toBe(true);
    expect(puedeVerDocumentos('trabajo_social')).toBe(true);
    expect(puedeVerDocumentos('psicologia')).toBe(true);
    expect(puedeVerDocumentos('juridico')).toBe(true);

    expect(puedeVerDocumentos('recepcion')).toBe(false);
    expect(puedeVerDocumentos('umeca')).toBe(false);
    expect(puedeVerDocumentos(undefined)).toBe(false);
    expect(puedeVerDocumentos(null)).toBe(false);
  });
});
