import { describe, expect, it } from 'vitest';
import {
  mapOrdenProteccionRow,
  toOrdenProteccionInsert,
  toOrdenProteccionUpdate,
  traducirErrorOrdenProteccion,
  type OrdenProteccionRow,
} from '@/infrastructure/supabase/adapters/ordenProteccion.mapper';

const SAMPLE_ROW: OrdenProteccionRow = {
  id: 'ord-1',
  ficha_id: 'ficha-1',
  agresor_id: 'agr-1',
  numero_oficio: 'OF-2026-099',
  autoridad_emisora: 'Juzgado Familiar',
  fecha_emision: '2026-11-20',
  fecha_vigencia: '2026-12-20',
  estado: 'vigente',
  activo: true,
  creado_en: '2026-11-20T12:00:00Z',
  actualizado_en: '2026-11-21T15:00:00Z',
};

describe('ordenProteccion.mapper', () => {
  it('mapea filas snake_case a camelCase y computa vigente según fecha de referencia', () => {
    expect(mapOrdenProteccionRow(SAMPLE_ROW, '2026-11-26')).toEqual({
      id: 'ord-1',
      fichaId: 'ficha-1',
      agresorId: 'agr-1',
      numeroOficio: 'OF-2026-099',
      autoridadEmisora: 'Juzgado Familiar',
      fechaEmision: '2026-11-20',
      fechaVigencia: '2026-12-20',
      estado: 'vigente',
      vigente: true,
      activo: true,
      creadoEn: '2026-11-20T12:00:00Z',
      actualizadoEn: '2026-11-21T15:00:00Z',
    });

    expect(mapOrdenProteccionRow(SAMPLE_ROW, '2026-12-21').vigente).toBe(false);
  });

  it('mapea inputs de creación y actualización limpiando espacios y campos opcionales', () => {
    const insert = toOrdenProteccionInsert({
      fichaId: 'ficha-1',
      agresorId: '',
      numeroOficio: '  OF-12  ',
      autoridadEmisora: '  MP Ahome  ',
      fechaEmision: '2026-11-26',
      fechaVigencia: '   ',
      estado: 'en_tramite',
    });

    expect(insert).toEqual({
      ficha_id: 'ficha-1',
      agresor_id: null,
      numero_oficio: 'OF-12',
      autoridad_emisora: 'MP Ahome',
      fecha_emision: '2026-11-26',
      fecha_vigencia: null,
      estado: 'en_tramite',
    });

    const update = toOrdenProteccionUpdate({
      fichaId: 'ficha-1',
      agresorId: 'agr-2',
      numeroOficio: 'OF-12',
      autoridadEmisora: 'Juzgado',
      fechaEmision: '2026-11-26',
      fechaVigencia: '2027-01-26',
      estado: 'vigente',
    });

    expect(update).toEqual({
      agresor_id: 'agr-2',
      numero_oficio: 'OF-12',
      autoridad_emisora: 'Juzgado',
      fecha_emision: '2026-11-26',
      fecha_vigencia: '2027-01-26',
      estado: 'vigente',
    });
  });

  it('envía la nota del cambio de estado solo cuando existe (columna transitoria nota_cambio_estado)', () => {
    const base = {
      fichaId: 'ficha-1',
      numeroOficio: 'OF-12',
      autoridadEmisora: 'Juzgado',
      fechaEmision: '2026-11-26',
      estado: 'cancelada' as const,
    };
    expect(toOrdenProteccionUpdate({ ...base, notaCambioEstado: '  Revocada por el juzgado  ' })).toMatchObject({
      estado: 'cancelada',
      nota_cambio_estado: 'Revocada por el juzgado',
    });
    expect(toOrdenProteccionUpdate({ ...base, notaCambioEstado: '   ' })).not.toHaveProperty(
      'nota_cambio_estado',
    );
    expect(toOrdenProteccionUpdate(base)).not.toHaveProperty('nota_cambio_estado');
  });

  it('traduce códigos de error Postgres sin exponer detalles internos', () => {
    expect(traducirErrorOrdenProteccion({ code: '42501' }, 'fallback').message).toMatch(/permisos/i);
    expect(traducirErrorOrdenProteccion({ code: '23503' }, 'fallback').message).toMatch(/agresora/i);
    expect(traducirErrorOrdenProteccion({ code: '23514' }, 'fallback').message).toMatch(/fechas/i);
    expect(
      traducirErrorOrdenProteccion({ code: 'P0001', message: 'Regla personalizada' }, 'fallback').message,
    ).toBe('Regla personalizada');
  });
});
