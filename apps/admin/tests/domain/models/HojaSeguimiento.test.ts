import { describe, expect, it } from 'vitest';
import type { AgendaItem, EstadoCita } from '@/domain/models/Cita';
import {
  citaAdmiteHojaSeguimiento,
  domicilioInputDesdeDetalle,
  domicilioModificado,
  ordenarCitasIntervencion,
  puedeAgendarProximaCita,
  puedeRegistrarHojaSeguimiento,
  rangoAgendaIntervenciones,
  validateHojaCopia,
  type HojaSeguimientoCopia,
} from '@/domain/models/HojaSeguimiento';

function cita(id: string, estado: EstadoCita, programadaEn: string): AgendaItem {
  return {
    citaId: id,
    programadaEn,
    estado,
    prioridad: null,
    areaId: 2,
    areaClave: 'psicologia',
    recomendadaPor: null,
    reagendadaDe: null,
    origen: 'regular',
    personaId: 'p-1',
    nombreCompleto: 'Persona Sintética',
    celular: null,
  };
}

const COPIA: HojaSeguimientoCopia = {
  personaId: 'p-1',
  estadoCivil: 'soltero',
  ocupacionId: 1,
  ocupacionOtra: null,
  celular: '6681234567',
  domicilio: null,
};

describe('HojaSeguimiento (RF-09, RN-04, RN-13)', () => {
  it('solo admite asistencia y hoja sobre citas agendadas o confirmadas', () => {
    expect(citaAdmiteHojaSeguimiento('agendada')).toBe(true);
    expect(citaAdmiteHojaSeguimiento('confirmada')).toBe(true);
    for (const estado of ['asistio', 'no_asistio', 'cancelada', 'reagendada'] as const) {
      expect(citaAdmiteHojaSeguimiento(estado)).toBe(false);
    }
  });

  it('solo Jurídico agenda la próxima cita; las áreas de atención registran la hoja', () => {
    expect(puedeAgendarProximaCita('juridico')).toBe(true);
    expect(puedeAgendarProximaCita('psicologia')).toBe(false);
    expect(puedeAgendarProximaCita('trabajo_social')).toBe(false);
    expect(puedeRegistrarHojaSeguimiento('psicologia')).toBe(true);
    expect(puedeRegistrarHojaSeguimiento('titular')).toBe(false);
    expect(puedeRegistrarHojaSeguimiento('recepcion')).toBe(false);
  });

  it('valida la copia histórica del día (celular, ocupación y domicilio)', () => {
    expect(validateHojaCopia(COPIA)).toBeNull();
    expect(validateHojaCopia({ ...COPIA, celular: '' })).toBeNull();
    expect(validateHojaCopia({ ...COPIA, celular: '66812' })).toMatch(/10 dígitos/);
    expect(validateHojaCopia({ ...COPIA, ocupacionOtra: 'x'.repeat(151) })).toMatch(/150/);
    expect(
      validateHojaCopia({
        ...COPIA,
        domicilio: { ...domicilioInputDesdeDetalle(null), calle: 'Calle 1' },
      }),
    ).toMatch(/código postal/i);
  });

  it('detecta si el domicilio del día cambió respecto al vigente', () => {
    const original = domicilioInputDesdeDetalle({
      id: 'd-1',
      asentamientoId: 10,
      asentamientoNombre: 'Centro',
      codigoPostal: '81200',
      calle: 'Calle Uno',
      numeroExterior: '12',
      numeroInterior: null,
      referencias: null,
      zona: 'urbana',
    });
    expect(original.codigoPostalForaneo).toBe('');
    expect(domicilioModificado(original, { ...original, calle: ' Calle Uno ' })).toBe(false);
    expect(domicilioModificado(original, { ...original, numeroExterior: '14' })).toBe(true);
    expect(domicilioModificado(original, { ...original, asentamientoId: 11 })).toBe(true);
  });

  it('calcula el rango de agenda en hora de Mazatlán', () => {
    // 02:00 UTC del día 27 = 19:00 del día 26 en Mazatlán.
    expect(rangoAgendaIntervenciones(new Date('2026-11-27T02:00:00Z'))).toEqual({
      desde: '2026-11-19T00:00:00-07:00',
      hasta: '2026-11-27T23:59:59-07:00',
    });
  });

  it('ordena pendientes primero (próximas arriba) y luego resueltas recientes', () => {
    const ordenadas = ordenarCitasIntervencion([
      cita('resuelta-vieja', 'asistio', '2026-11-20T16:00:00Z'),
      cita('pendiente-tarde', 'agendada', '2026-11-26T20:00:00Z'),
      cita('resuelta-reciente', 'no_asistio', '2026-11-25T16:00:00Z'),
      cita('pendiente-temprano', 'confirmada', '2026-11-26T16:00:00Z'),
    ]);
    expect(ordenadas.map((c) => c.citaId)).toEqual([
      'pendiente-temprano',
      'pendiente-tarde',
      'resuelta-reciente',
      'resuelta-vieja',
    ]);
  });
});
