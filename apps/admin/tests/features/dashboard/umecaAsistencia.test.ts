import { describe, expect, it } from 'vitest';
import {
  AREA_SIN_DATO,
  areaUmecaLabel,
  asistenciaInfo,
  fechaCitaUmeca,
  opcionesArea,
  resumenAsistencia,
} from '@/features/dashboard/umecaAsistencia';

describe('asistenciaInfo (estados de get_umeca_citas)', () => {
  it('traduce los cuatro valores del RPC a etiquetas legibles', () => {
    expect(asistenciaInfo('asistio').label).toBe('Asistió');
    expect(asistenciaInfo('no_asistio').label).toBe('No asistió');
    expect(asistenciaInfo('pendiente').label).toBe('Pendiente');
    expect(asistenciaInfo('cancelo').label).toBe('Canceló');
  });

  it('acepta estados internos y nunca muestra una clave cruda', () => {
    expect(asistenciaInfo('agendada').clave).toBe('pendiente');
    expect(asistenciaInfo('confirmada').clave).toBe('pendiente');
    expect(asistenciaInfo('cancelada').clave).toBe('cancelo');
    expect(asistenciaInfo('algo_raro').clave).toBe('pendiente');
  });
});

describe('resumenAsistencia', () => {
  it('cuenta asistió, no asistió, pendiente y canceló', () => {
    expect(resumenAsistencia(['asistio', 'asistio', 'no_asistio', 'pendiente', 'cancelo', 'agendada'])).toEqual({
      total: 6,
      asistio: 2,
      no_asistio: 1,
      pendiente: 2,
      cancelo: 1,
    });
  });
});

describe('fechaCitaUmeca', () => {
  it('formatea día, mes, año y hora de Mazatlán', () => {
    const texto = fechaCitaUmeca('2026-11-26T17:00:00Z');
    expect(texto).toContain('26');
    expect(texto).toContain('2026');
    expect(texto).toContain('10:00');
  });

  it('devuelve el texto original si la fecha es inválida', () => {
    expect(fechaCitaUmeca('no-fecha')).toBe('no-fecha');
  });
});

describe('areaUmecaLabel', () => {
  it('usa el nombre del RPC y, si falta, el de la clave conocida', () => {
    expect(areaUmecaLabel('psicologia', 'Psicología')).toBe('Psicología');
    expect(areaUmecaLabel('juridico', null)).toBe('Jurídico');
    expect(areaUmecaLabel('trabajo_social', '  ')).toBe('Trabajo Social');
    expect(areaUmecaLabel('area_nueva', null)).toBe('Area nueva');
  });

  it('sin datos del RPC muestra «Sin área»', () => {
    expect(areaUmecaLabel(null, null)).toBe(AREA_SIN_DATO);
    expect(areaUmecaLabel(undefined, undefined)).toBe('Sin área');
  });
});

describe('opcionesArea', () => {
  it('lista las áreas presentes sin repetir y en orden alfabético', () => {
    expect(opcionesArea(['Psicología', 'Jurídico', 'Psicología', 'Trabajo Social'])).toEqual([
      { value: 'Jurídico', label: 'Jurídico' },
      { value: 'Psicología', label: 'Psicología' },
      { value: 'Trabajo Social', label: 'Trabajo Social' },
    ]);
    expect(opcionesArea([])).toEqual([]);
  });
});
