import { describe, expect, it } from 'vitest';
import type { DocumentoAdjunto } from '@/features/expedientes/documentosApi';
import {
  formatFechaDocumento,
  getChecklistSlotKey,
  groupDocumentosByTipo,
  partitionDocumentosPorSlot,
  summarizeChecklist,
  summarizeDocumentos,
} from '@/features/expedientes/documentos/documentoGrouping';

function makeDoc(overrides: Partial<DocumentoAdjunto> = {}): DocumentoAdjunto {
  return {
    id: 'doc-1',
    fichaId: 'ficha-1',
    tipoDocumentoId: 1,
    tipoDocumentoClave: 'ine',
    tipoDocumentoNombre: 'Copia de la INE',
    ordenProteccionId: null,
    descripcion: null,
    rutaStorage: 'ficha-1/uuid-ine.jpg',
    nombreArchivo: 'ine.jpg',
    activo: true,
    creadoEn: '2026-11-25T16:30:00Z',
    ...overrides,
  };
}

describe('documentoGrouping', () => {
  it('agrupa documentos en el orden INE, Fotografía, Denuncia y Otros omitiendo grupos vacíos', () => {
    const docs: DocumentoAdjunto[] = [
      makeDoc({ id: 'd-otro', tipoDocumentoClave: 'solicitud', tipoDocumentoNombre: 'Hoja de solicitud' }),
      makeDoc({ id: 'd-denuncia', tipoDocumentoClave: 'denuncia', tipoDocumentoNombre: 'Copia de la denuncia' }),
      makeDoc({ id: 'd-ine', tipoDocumentoClave: 'ine', tipoDocumentoNombre: 'Copia de la INE' }),
      makeDoc({ id: 'd-curp', tipoDocumentoClave: 'curp', tipoDocumentoNombre: 'Constancia de CURP' }),
    ];

    const groups = groupDocumentosByTipo(docs);

    expect(groups.map((g) => g.key)).toEqual(['ine', 'denuncia', 'otros']);
    expect(groups[0]?.items.map((d) => d.id)).toEqual(['d-ine']);
    expect(groups[1]?.items.map((d) => d.id)).toEqual(['d-denuncia']);
    expect(groups[2]?.items.map((d) => d.id)).toEqual(['d-otro', 'd-curp']);
  });

  it('particiona documentos en las 5 ranuras del checklist (INE, foto, denuncia, orden y otro)', () => {
    const docs: DocumentoAdjunto[] = [
      makeDoc({ id: 'd-ine', tipoDocumentoClave: 'ine' }),
      makeDoc({ id: 'd-orden', tipoDocumentoClave: 'orden_proteccion', tipoDocumentoNombre: 'Copia de la orden de protección' }),
      makeDoc({ id: 'd-curp', tipoDocumentoClave: 'curp', tipoDocumentoNombre: 'Constancia de CURP' }),
      makeDoc({ id: 'd-otro', tipoDocumentoClave: 'otro', tipoDocumentoNombre: 'Otro' }),
    ];

    expect(getChecklistSlotKey('orden_proteccion')).toBe('orden_proteccion');
    expect(getChecklistSlotKey('curp')).toBe('otro');

    const slots = partitionDocumentosPorSlot(docs);
    expect(slots.ine.map((d) => d.id)).toEqual(['d-ine']);
    expect(slots.foto).toEqual([]);
    expect(slots.denuncia).toEqual([]);
    expect(slots.orden_proteccion.map((d) => d.id)).toEqual(['d-orden']);
    expect(slots.otro.map((d) => d.id)).toEqual(['d-curp', 'd-otro']);
  });

  it('resume el total y la presencia de documentos clave en summarizeDocumentos y summarizeChecklist', () => {
    const docs: DocumentoAdjunto[] = [
      makeDoc({ id: 'd-ine', tipoDocumentoClave: 'ine' }),
      makeDoc({ id: 'd-foto', tipoDocumentoClave: 'foto', tipoDocumentoNombre: 'Fotografía' }),
      makeDoc({ id: 'd-orden', tipoDocumentoClave: 'orden_proteccion', tipoDocumentoNombre: 'Copia de la orden de protección' }),
      makeDoc({ id: 'd-otro', tipoDocumentoClave: 'otro', tipoDocumentoNombre: 'Otro' }),
    ];

    expect(summarizeDocumentos(docs)).toEqual({
      total: 4,
      hasIne: true,
      hasFoto: true,
      hasDenuncia: false,
    });
    expect(summarizeChecklist(docs)).toEqual({
      total: 4,
      hasIne: true,
      hasFoto: true,
      hasDenuncia: false,
      hasOrdenProteccion: true,
      hasOtro: true,
      keyCompleted: 3,
      keyTotal: 4,
    });
    expect(summarizeDocumentos([])).toEqual({
      total: 0,
      hasIne: false,
      hasFoto: false,
      hasDenuncia: false,
    });
  });

  it('formatea fechas ISO válidas y conserva el texto original si la fecha es inválida', () => {
    expect(formatFechaDocumento('2026-11-25T16:30:00Z')).toContain('2026');
    expect(formatFechaDocumento('fecha-invalida')).toBe('fecha-invalida');
  });
});
