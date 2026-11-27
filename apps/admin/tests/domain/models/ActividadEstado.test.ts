import { describe, expect, it } from 'vitest';
import {
  accionesActividad,
  aplicarCambioEstado,
  esVencida,
  validarTransicionActividad,
  validateCambioEstadoActividad,
} from '@/domain/models/ActividadEstado';
import { act } from '../../features/actividades/fixtures';

const AHORA = new Date('2026-12-03T17:00:00Z');

describe('esVencida', () => {
  it('solo una pendiente cuya fecha ya pasó está vencida', () => {
    expect(esVencida({ estado: 'pendiente', programadaEn: '2026-12-03T16:59:00Z' }, AHORA)).toBe(true);
    expect(esVencida({ estado: 'pendiente', programadaEn: '2026-12-03T17:00:00Z' }, AHORA)).toBe(false);
    expect(esVencida({ estado: 'pendiente', programadaEn: '2026-12-10T17:00:00Z' }, AHORA)).toBe(false);
    expect(esVencida({ estado: 'realizada', programadaEn: '2026-11-01T17:00:00Z' }, AHORA)).toBe(false);
    expect(esVencida({ estado: 'cancelada', programadaEn: '2026-11-01T17:00:00Z' }, AHORA)).toBe(false);
  });
});

describe('accionesActividad', () => {
  it('pendiente: editar, realizar y cancelar; realizada / cancelada: reabrir', () => {
    expect(accionesActividad('pendiente', true)).toEqual({ editar: true, realizar: true, cancelar: true, reabrir: false });
    expect(accionesActividad('realizada', true)).toEqual({ editar: false, realizar: false, cancelar: false, reabrir: true });
    expect(accionesActividad('cancelada', true)).toEqual({ editar: false, realizar: false, cancelar: false, reabrir: true });
  });

  it('sin actividad.registrar no hay ninguna acción', () => {
    for (const estado of ['pendiente', 'realizada', 'cancelada'] as const) {
      expect(accionesActividad(estado, false)).toEqual({ editar: false, realizar: false, cancelar: false, reabrir: false });
    }
  });
});

describe('validarTransicionActividad', () => {
  it('permite pendiente → realizada | cancelada y realizada | cancelada → pendiente', () => {
    expect(validarTransicionActividad('pendiente', 'realizada')).toBeNull();
    expect(validarTransicionActividad('pendiente', 'cancelada')).toBeNull();
    expect(validarTransicionActividad('realizada', 'pendiente')).toBeNull();
    expect(validarTransicionActividad('cancelada', 'pendiente')).toBeNull();
  });

  it('rechaza el mismo estado (el RPC responde 22023)', () => {
    expect(validarTransicionActividad('pendiente', 'pendiente')).toMatch(/ya está pendiente/);
    expect(validarTransicionActividad('realizada', 'realizada')).toMatch(/ya está realizada/);
  });

  it('exige reabrir antes de pasar de realizada a cancelada y viceversa', () => {
    expect(validarTransicionActividad('realizada', 'cancelada')).toMatch(/Reabre/);
    expect(validarTransicionActividad('cancelada', 'realizada')).toMatch(/Reabre/);
  });
});

describe('validateCambioEstadoActividad', () => {
  const base = { actividadId: 'a1' };

  it('acepta asistentes de 0 a 10000 y observaciones al realizar', () => {
    expect(validateCambioEstadoActividad('pendiente', { ...base, estado: 'realizada', numeroAsistentes: 0 })).toBeNull();
    expect(
      validateCambioEstadoActividad('pendiente', {
        ...base,
        estado: 'realizada',
        numeroAsistentes: 10000,
        observaciones: 'Todo bien',
      }),
    ).toBeNull();
    expect(validateCambioEstadoActividad('pendiente', { ...base, estado: 'realizada' })).toBeNull();
  });

  it('rechaza asistentes fuera de rango o no enteros', () => {
    for (const n of [-1, 10001, 2.5, Number.NaN]) {
      expect(validateCambioEstadoActividad('pendiente', { ...base, estado: 'realizada', numeroAsistentes: n })).toMatch(
        /entre 0 y 10000/,
      );
    }
  });

  it('los asistentes solo se registran al realizar', () => {
    expect(validateCambioEstadoActividad('pendiente', { ...base, estado: 'cancelada', numeroAsistentes: 5 })).toMatch(
      /solo se registra/,
    );
  });

  it('el motivo y las observaciones son opcionales pero acotados', () => {
    expect(validateCambioEstadoActividad('pendiente', { ...base, estado: 'cancelada', motivoCancelacion: '   ' })).toBeNull();
    expect(
      validateCambioEstadoActividad('pendiente', { ...base, estado: 'cancelada', motivoCancelacion: 'x'.repeat(501) }),
    ).toMatch(/500/);
    expect(
      validateCambioEstadoActividad('pendiente', { ...base, estado: 'realizada', observaciones: 'x'.repeat(1001) }),
    ).toMatch(/1000/);
  });

  it('propaga el error de transición', () => {
    expect(validateCambioEstadoActividad('realizada', { ...base, estado: 'realizada' })).toMatch(/ya está realizada/);
  });
});

describe('aplicarCambioEstado (proyección optimista)', () => {
  const ahoraIso = '2026-12-03T17:00:00.000Z';

  it('realizada: guarda hora de cierre, asistentes y observaciones recortadas', () => {
    const item = act('a1', '2026-12-02T17:00:00Z', { numeroAsistentes: 40, canceladaMotivo: 'viejo' });
    const r = aplicarCambioEstado(
      item,
      { actividadId: 'a1', estado: 'realizada', numeroAsistentes: 55, observaciones: '  Buen cierre ' },
      ahoraIso,
    );
    expect(r).toMatchObject({
      estado: 'realizada',
      realizadaEn: ahoraIso,
      numeroAsistentes: 55,
      observacionesCierre: 'Buen cierre',
      canceladaMotivo: null,
    });
  });

  it('realizada sin asistentes conserva los esperados', () => {
    const item = act('a1', '2026-12-02T17:00:00Z', { numeroAsistentes: 40 });
    expect(aplicarCambioEstado(item, { actividadId: 'a1', estado: 'realizada' }, ahoraIso).numeroAsistentes).toBe(40);
  });

  it('cancelada: guarda el motivo (vacío = null) y limpia el cierre', () => {
    const item = act('a1', '2026-12-02T17:00:00Z', { realizadaEn: ahoraIso });
    expect(
      aplicarCambioEstado(item, { actividadId: 'a1', estado: 'cancelada', motivoCancelacion: ' Lluvia ' }, ahoraIso),
    ).toMatchObject({ estado: 'cancelada', canceladaMotivo: 'Lluvia', realizadaEn: null });
    expect(
      aplicarCambioEstado(item, { actividadId: 'a1', estado: 'cancelada', motivoCancelacion: '  ' }, ahoraIso).canceladaMotivo,
    ).toBeNull();
  });

  it('reabrir: vuelve a pendiente sin cierre ni motivo', () => {
    const item = act('a1', '2026-12-02T17:00:00Z', { estado: 'cancelada', canceladaMotivo: 'Lluvia', observacionesCierre: 'x', numeroAsistentes: 12 });
    expect(aplicarCambioEstado(item, { actividadId: 'a1', estado: 'pendiente' }, ahoraIso)).toMatchObject({
      estado: 'pendiente',
      realizadaEn: null,
      canceladaMotivo: null,
      observacionesCierre: null,
      numeroAsistentes: 12,
    });
  });

  it('no muta la actividad original', () => {
    const item = act('a1', '2026-12-02T17:00:00Z');
    aplicarCambioEstado(item, { actividadId: 'a1', estado: 'cancelada' }, ahoraIso);
    expect(item.estado).toBe('pendiente');
  });
});
