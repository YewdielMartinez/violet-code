import { describe, expect, it } from 'vitest';
import {
  esEstadoActividad,
  puedeRegistrarActividad,
  validateActividadCampos,
  validateActividadPreventiva,
  type ActividadPreventivaCreateInput,
} from '@/domain/models/ActividadPreventiva';

const VALIDA: ActividadPreventivaCreateInput = {
  titulo: 'Violencia en el noviazgo',
  tipoActividadId: 2,
  tipoInstitucion: 'escuela',
  nivelEducativo: 'secundaria',
  sede: 'Secundaria Técnica 12',
  programadaEn: '2026-12-03T10:00:00-07:00',
};

describe('ActividadPreventiva (RF-16)', () => {
  it('acepta un alta completa y devuelve null en la validación de primer error', () => {
    expect(validateActividadCampos(VALIDA)).toEqual({});
    expect(validateActividadPreventiva(VALIDA)).toBeNull();
  });

  it('marca cada campo obligatorio vacío o inválido', () => {
    const errores = validateActividadCampos({
      ...VALIDA,
      titulo: '   ',
      tipoActividadId: 0,
      tipoInstitucion: '' as never,
      nivelEducativo: null,
      sede: '',
      programadaEn: 'ayer',
    });
    expect(Object.keys(errores).sort()).toEqual(['programadaEn', 'sede', 'tipoActividadId', 'tipoInstitucion', 'titulo']);
  });

  it('limita título, sede, dirección y referencias', () => {
    const errores = validateActividadCampos({
      ...VALIDA,
      titulo: 'a'.repeat(201),
      sede: 'b'.repeat(201),
      direccion: 'c'.repeat(251),
      referencias: 'd'.repeat(251),
    });
    expect(errores.titulo).toMatch(/200/);
    expect(errores.sede).toMatch(/200/);
    expect(errores.direccion).toMatch(/250/);
    expect(errores.referencias).toMatch(/250/);
  });

  it('el nivel educativo solo aplica a escuelas', () => {
    expect(validateActividadCampos({ ...VALIDA, tipoInstitucion: 'empresa_privada' }).nivelEducativo).toMatch(/escuela/);
    expect(validateActividadCampos({ ...VALIDA, tipoInstitucion: 'empresa_privada', nivelEducativo: null })).toEqual({});
  });

  it('valida el número de asistentes entre 0 y 10000', () => {
    expect(validateActividadCampos({ ...VALIDA, numeroAsistentes: 0 })).toEqual({});
    expect(validateActividadCampos({ ...VALIDA, numeroAsistentes: 10000 })).toEqual({});
    expect(validateActividadCampos({ ...VALIDA, numeroAsistentes: -1 }).numeroAsistentes).toBeTruthy();
    expect(validateActividadCampos({ ...VALIDA, numeroAsistentes: 10001 }).numeroAsistentes).toBeTruthy();
    expect(validateActividadCampos({ ...VALIDA, numeroAsistentes: 2.5 }).numeroAsistentes).toBeTruthy();
    expect(validateActividadCampos({ ...VALIDA, numeroAsistentes: null })).toEqual({});
  });

  it('validateActividadPreventiva devuelve el primer mensaje', () => {
    expect(validateActividadPreventiva({ ...VALIDA, titulo: '' })).toMatch(/título/i);
  });

  it('reconoce solo los tres estados del enum estado_actividad', () => {
    for (const estado of ['pendiente', 'realizada', 'cancelada']) expect(esEstadoActividad(estado)).toBe(true);
    for (const raro of ['abierta', '', null, undefined, 3]) expect(esEstadoActividad(raro)).toBe(false);
  });

  it('actividad.registrar: dirección y áreas de atención; no recepción ni UMECA', () => {
    for (const role of ['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico'] as const) {
      expect(puedeRegistrarActividad(role)).toBe(true);
    }
    expect(puedeRegistrarActividad('recepcion')).toBe(false);
    expect(puedeRegistrarActividad('umeca')).toBe(false);
    expect(puedeRegistrarActividad(undefined)).toBe(false);
  });
});
