import { describe, expect, it } from 'vitest';
import { asistenciaInfo, fechaCitaUmeca, resumenAsistencia } from '@/features/dashboard/umecaAsistencia';

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
