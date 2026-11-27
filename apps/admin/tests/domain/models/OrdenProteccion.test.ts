import { describe, expect, it } from 'vitest';
import {
  AUTORIDAD_EMISORA_MAX_LENGTH,
  NUMERO_OFICIO_MAX_LENGTH,
  esOrdenVigente,
  puedeEscribirOrdenesProteccion,
  puedeVerOrdenesProteccion,
  validarOrdenProteccion,
} from '@/domain/models/OrdenProteccion';

describe('OrdenProteccion (RF-17 / RN-17)', () => {
  it('calcula vigencia a partir de activo, estado y fechaVigencia', () => {
    const hoy = '2026-11-26';

    expect(
      esOrdenVigente({ activo: true, estado: 'vigente', fechaVigencia: '2026-12-01' }, hoy),
    ).toBe(true);
    expect(
      esOrdenVigente({ activo: true, estado: 'vigente', fechaVigencia: '2026-11-26' }, hoy),
    ).toBe(true);
    expect(
      esOrdenVigente({ activo: true, estado: 'vigente', fechaVigencia: null }, hoy),
    ).toBe(true);

    // Casos no vigentes
    expect(
      esOrdenVigente({ activo: true, estado: 'vigente', fechaVigencia: '2026-11-25' }, hoy),
    ).toBe(false);
    expect(
      esOrdenVigente({ activo: true, estado: 'en_tramite', fechaVigencia: '2026-12-01' }, hoy),
    ).toBe(false);
    expect(
      esOrdenVigente({ activo: true, estado: 'vencida', fechaVigencia: '2026-12-01' }, hoy),
    ).toBe(false);
    expect(
      esOrdenVigente({ activo: true, estado: 'cancelada', fechaVigencia: null }, hoy),
    ).toBe(false);
    expect(
      esOrdenVigente({ activo: false, estado: 'vigente', fechaVigencia: '2026-12-01' }, hoy),
    ).toBe(false);
  });

  it('valida campos obligatorios, longitudes máximas, estado y fecha_emision <= fecha_vigencia', () => {
    const valida = validarOrdenProteccion({
      fichaId: 'ficha-1',
      numeroOficio: 'OF-2026-001',
      autoridadEmisora: 'Juzgado Familiar de Ahome',
      fechaEmision: '2026-11-20',
      fechaVigencia: '2026-12-20',
      estado: 'vigente',
    });
    expect(valida).toEqual({ valido: true, errores: {} });

    const mismaFecha = validarOrdenProteccion({
      fichaId: 'ficha-1',
      numeroOficio: 'OF-2026-002',
      autoridadEmisora: 'Ministerio Público',
      fechaEmision: '2026-11-20',
      fechaVigencia: '2026-11-20',
      estado: 'en_tramite',
    });
    expect(mismaFecha.valido).toBe(true);

    const invalida = validarOrdenProteccion({
      fichaId: '',
      numeroOficio: 'x'.repeat(NUMERO_OFICIO_MAX_LENGTH + 1),
      autoridadEmisora: 'y'.repeat(AUTORIDAD_EMISORA_MAX_LENGTH + 1),
      fechaEmision: '2026-11-25',
      fechaVigencia: '2026-11-20',
      estado: 'invalido' as never,
    });
    expect(invalida.valido).toBe(false);
    expect(invalida.errores.fichaId).toBeDefined();
    expect(invalida.errores.numeroOficio).toMatch(/80 caracteres/i);
    expect(invalida.errores.autoridadEmisora).toMatch(/150 caracteres/i);
    expect(invalida.errores.fechaVigencia).toMatch(/anterior/i);
    expect(invalida.errores.estado).toBeDefined();

    const vacia = validarOrdenProteccion({
      fichaId: 'ficha-1',
      numeroOficio: '   ',
      autoridadEmisora: '',
      fechaEmision: '2026-02-31',
      fechaVigencia: null,
      estado: 'vigente',
    });
    expect(vacia.valido).toBe(false);
    expect(vacia.errores.numeroOficio).toMatch(/obligatorio/i);
    expect(vacia.errores.autoridadEmisora).toMatch(/obligatoria/i);
    expect(vacia.errores.fechaEmision).toMatch(/válido/i);
  });

  it('controla permisos de lectura y escritura según RLS (orden_proteccion.escribir)', () => {
    expect(puedeVerOrdenesProteccion('titular')).toBe(true);
    expect(puedeVerOrdenesProteccion('psicologia')).toBe(true);
    expect(puedeVerOrdenesProteccion('recepcion')).toBe(false);
    expect(puedeVerOrdenesProteccion('umeca')).toBe(false);

    expect(puedeEscribirOrdenesProteccion('titular')).toBe(true);
    expect(puedeEscribirOrdenesProteccion('subdireccion')).toBe(true);
    expect(puedeEscribirOrdenesProteccion('juridico')).toBe(true);
    expect(puedeEscribirOrdenesProteccion('trabajo_social')).toBe(true);
    expect(puedeEscribirOrdenesProteccion('psicologia')).toBe(false);
    expect(puedeEscribirOrdenesProteccion('recepcion')).toBe(false);
    expect(puedeEscribirOrdenesProteccion('umeca')).toBe(false);
  });

  it('valida el largo de la nota del cambio de estado (opcional)', () => {
    const base = {
      fichaId: 'ficha-1',
      numeroOficio: 'OF-1',
      autoridadEmisora: 'Juzgado',
      fechaEmision: '2026-11-20',
      fechaVigencia: null,
      estado: 'vencida' as const,
    };
    expect(validarOrdenProteccion({ ...base, notaCambioEstado: 'Venció el plazo' }).valido).toBe(true);
    expect(validarOrdenProteccion({ ...base, notaCambioEstado: null }).valido).toBe(true);
    const larga = validarOrdenProteccion({ ...base, notaCambioEstado: 'x'.repeat(1001) });
    expect(larga.valido).toBe(false);
    expect(larga.errores.notaCambioEstado).toMatch(/1000/);
  });
});
