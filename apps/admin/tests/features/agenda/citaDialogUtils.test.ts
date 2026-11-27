import { describe, expect, it } from 'vitest';
import {
  accionesDisponibles,
  aIsoMazatlan,
  areasPermitidas,
  esCitaUmeca,
  puedeGestionarCita,
  fechaInicialCita,
  fechaPared,
  inicialNombre,
  mensajeError,
  partesHora,
  propuestaReagendar,
  tituloDia,
} from '@/features/agenda/citaDialogUtils';

const AREAS = [
  { id: 1, clave: 'trabajo_social', nombre: 'Trabajo Social' },
  { id: 2, clave: 'psicologia', nombre: 'Psicología' },
  { id: 3, clave: 'juridico', nombre: 'Jurídico' },
];

describe('areasPermitidas (regla única de alta)', () => {
  it('Recepción agenda en Trabajo Social, Psicología y Jurídico', () => {
    expect(areasPermitidas('recepcion', AREAS).map((a) => a.clave)).toEqual(['trabajo_social', 'psicologia', 'juridico']);
  });

  it('Jurídico solo en Jurídico y Psicología solo en Psicología', () => {
    expect(areasPermitidas('juridico', AREAS).map((a) => a.clave)).toEqual(['juridico']);
    expect(areasPermitidas('psicologia', AREAS).map((a) => a.clave)).toEqual(['psicologia']);
  });

  it('Dirección y Subdirección agendan en todas las áreas', () => {
    for (const role of ['titular', 'subdireccion'] as const) {
      expect(areasPermitidas(role, AREAS).map((a) => a.clave)).toEqual(['trabajo_social', 'psicologia', 'juridico']);
    }
  });

  it('Trabajo Social y UMECA no agendan en ninguna área', () => {
    for (const role of ['trabajo_social', 'umeca'] as const) {
      expect(areasPermitidas(role, AREAS)).toEqual([]);
    }
    expect(areasPermitidas(undefined, AREAS)).toEqual([]);
  });
});

describe('esCitaUmeca', () => {
  it('distingue el origen umeca del regular', () => {
    expect(esCitaUmeca({ origen: 'umeca' })).toBe(true);
    expect(esCitaUmeca({ origen: 'regular' })).toBe(false);
  });
});

describe('puedeGestionarCita', () => {
  it('Recepción gestiona Trabajo Social, Psicología y Jurídico', () => {
    for (const areaClave of ['trabajo_social', 'psicologia', 'juridico']) {
      expect(puedeGestionarCita('recepcion', null, { areaId: 9, areaClave })).toBe(true);
    }
    expect(puedeGestionarCita('recepcion', null, { areaId: 9, areaClave: 'otra' })).toBe(false);
  });

  it('un área solo gestiona la suya y Dirección todas', () => {
    expect(puedeGestionarCita('juridico', 3, { areaId: 3, areaClave: 'juridico' })).toBe(true);
    expect(puedeGestionarCita('juridico', 3, { areaId: 1, areaClave: 'trabajo_social' })).toBe(false);
    expect(puedeGestionarCita('titular', null, { areaId: 1, areaClave: 'trabajo_social' })).toBe(true);
    expect(puedeGestionarCita('umeca', null, { areaId: 1, areaClave: 'trabajo_social' })).toBe(false);
  });
});

describe('accionesDisponibles · reagendar sigue la regla de alta', () => {
  const agendada = (areaId: number, areaClave: string) => ({ estado: 'agendada' as const, areaId, areaClave });

  it('Recepción y Dirección reagendan en las tres áreas; Jurídico y Psicología solo en la suya', () => {
    expect(accionesDisponibles(agendada(1, 'trabajo_social'), 'recepcion', null).reagendar).toBe(true);
    expect(accionesDisponibles(agendada(3, 'juridico'), 'recepcion', null).reagendar).toBe(true);
    expect(accionesDisponibles(agendada(1, 'trabajo_social'), 'titular', null).reagendar).toBe(true);
    expect(accionesDisponibles(agendada(1, 'trabajo_social'), 'subdireccion', null).reagendar).toBe(true);
    expect(accionesDisponibles(agendada(3, 'juridico'), 'juridico', 3).reagendar).toBe(true);
    expect(accionesDisponibles(agendada(2, 'psicologia'), 'psicologia', 2).reagendar).toBe(true);
  });

  it('Trabajo Social no reagenda (aunque gestione la cita) y nadie reagenda fuera de su área', () => {
    expect(accionesDisponibles(agendada(1, 'trabajo_social'), 'trabajo_social', 1).reagendar).toBe(false);
    expect(accionesDisponibles(agendada(1, 'trabajo_social'), 'trabajo_social', 1).cancelar).toBe(true);
    expect(accionesDisponibles(agendada(1, 'trabajo_social'), 'psicologia', 2).reagendar).toBe(false);
    expect(accionesDisponibles(agendada(1, 'trabajo_social'), 'juridico', 3).reagendar).toBe(false);
  });
});

describe('accionesDisponibles', () => {
  const base = { areaId: 3, areaClave: 'juridico' };

  it('«Agendar siguiente cita» sigue la regla de alta sobre una cita atendida', () => {
    expect(accionesDisponibles({ ...base, estado: 'asistio' }, 'juridico', 3).agendarSiguiente).toBe(true);
    expect(accionesDisponibles({ ...base, estado: 'asistio' }, 'recepcion', null).agendarSiguiente).toBe(true);
    expect(accionesDisponibles({ ...base, estado: 'asistio' }, 'titular', null).agendarSiguiente).toBe(true);
    expect(accionesDisponibles({ ...base, estado: 'asistio' }, 'psicologia', 2).agendarSiguiente).toBe(false);
    expect(
      accionesDisponibles({ areaId: 2, areaClave: 'psicologia', estado: 'asistio' }, 'psicologia', 2).agendarSiguiente,
    ).toBe(true);
    expect(
      accionesDisponibles({ areaId: 1, areaClave: 'trabajo_social', estado: 'asistio' }, 'trabajo_social', 1)
        .agendarSiguiente,
    ).toBe(false);
    expect(accionesDisponibles({ ...base, estado: 'agendada' }, 'juridico', 3).agendarSiguiente).toBe(false);
  });

  it('solo el área de la cita registra la hoja (asistió)', () => {
    expect(accionesDisponibles({ ...base, estado: 'confirmada' }, 'juridico', 3).asistio).toBe(true);
    expect(accionesDisponibles({ ...base, estado: 'confirmada' }, 'titular', null).asistio).toBe(false);
    expect(accionesDisponibles({ ...base, estado: 'confirmada' }, 'recepcion', null).asistio).toBe(false);
  });

  it('respeta las transiciones válidas', () => {
    const agendada = accionesDisponibles({ ...base, estado: 'agendada' }, 'titular', null);
    // Dirección puede crear citas en todas las áreas, así que también reagenda.
    expect(agendada).toMatchObject({ confirmar: true, noAsistio: true, cancelar: true, reagendar: true });
    const confirmada = accionesDisponibles({ ...base, estado: 'confirmada' }, 'titular', null);
    expect(confirmada).toMatchObject({ confirmar: false, noAsistio: true, cancelar: true, reagendar: true });
    for (const estado of ['cancelada', 'reagendada', 'no_asistio'] as const) {
      expect(Object.values(accionesDisponibles({ ...base, estado }, 'titular', null)).some(Boolean)).toBe(false);
    }
  });
});

describe('fechas', () => {
  it('titula el día en español', () => {
    expect(tituloDia(new Date(2026, 10, 26))).toBe('Jueves 26 de noviembre');
  });

  it('convierte la hora de pared a ISO de Mazatlán (UTC-7)', () => {
    expect(aIsoMazatlan(new Date(2026, 10, 26, 9, 5))).toBe('2026-11-26T09:05:00-07:00');
  });

  it('precarga 09:00 si el recuadro no trae hora y respeta la hora si la trae', () => {
    expect(fechaInicialCita(new Date(2026, 10, 26)).getHours()).toBe(9);
    const conHora = fechaInicialCita(new Date(2026, 10, 26, 13, 30));
    expect([conHora.getHours(), conHora.getMinutes()]).toEqual([13, 30]);
  });

  it('lee la hora de pared de Mazatlán de un instante ISO', () => {
    const pared = fechaPared('2026-11-26T17:00:00Z');
    expect(pared && [pared.getDate(), pared.getHours()]).toEqual([26, 10]);
    expect(fechaPared('no-fecha')).toBeNull();
  });

  it('propone reagendar a futuro', () => {
    const ahora = new Date(2026, 10, 26, 12, 0);
    const propuesta = propuestaReagendar('2026-11-20T17:00:00Z', ahora);
    expect(propuesta.getTime()).toBeGreaterThan(ahora.getTime());
  });
});

describe('mensajeError', () => {
  it('usa el mensaje del servidor, traduce 42501 y cae al texto por defecto', () => {
    expect(mensajeError({ code: '23514', message: 'Mensaje del backend' }, 'x')).toBe('Mensaje del backend');
    expect(mensajeError({ code: '42501', message: 'permission denied' }, 'x')).toBe(
      'Tu rol o área no tiene permiso para esta acción.',
    );
    expect(mensajeError(null, 'Fallback')).toBe('Fallback');
  });
});

describe('partesHora (insignia de la lista del día)', () => {
  it('separa la hora compacta y el periodo, en hora de Mazatlán', () => {
    expect(partesHora('2026-11-26T15:02:00Z')).toEqual({ hora: '08:02', periodo: 'a.m.' });
    expect(partesHora('2026-11-26T22:30:00Z')).toEqual({ hora: '03:30', periodo: 'p.m.' });
  });

  it('un valor que no es fecha no rompe la lista', () => {
    expect(partesHora('no-fecha')).toEqual({ hora: 'no-fecha', periodo: '' });
  });
});

describe('inicialNombre', () => {
  it('toma la primera letra en mayúscula', () => {
    expect(inicialNombre('  ana López')).toBe('A');
    expect(inicialNombre('')).toBe('?');
  });
});
