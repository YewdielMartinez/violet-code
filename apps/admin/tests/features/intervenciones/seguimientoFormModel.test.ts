import { describe, expect, it } from 'vitest';
import type { ContextoHojaSeguimiento } from '@/domain/models/HojaSeguimiento';
import {
  buildSeguimientoInput,
  initialSeguimientoForm,
  localMazatlanToIso,
} from '@/features/intervenciones/seguimientoFormModel';

const CTX: ContextoHojaSeguimiento = {
  fichaId: 'f-1',
  folio: 'SEM-2026-0001',
  personaId: 'p-1',
  estadoCivil: 'casado',
  ocupacionId: 2,
  ocupacionOtra: null,
  celular: '6681112233',
  domicilio: {
    id: 'd-1',
    asentamientoId: null,
    asentamientoNombre: null,
    codigoPostal: '81200',
    calle: 'Calle Uno',
    numeroExterior: '5',
    numeroInterior: null,
    referencias: null,
    zona: 'urbana',
  },
};

const OPTS = { ctx: CTX, citaId: 'c-1', permiteAgendar: false };

describe('Hoja de seguimiento: armado del formulario (RF-09)', () => {
  it('precarga los datos del día desde la ficha vigente', () => {
    const state = initialSeguimientoForm(CTX);
    expect(state).toMatchObject({
      asistencia: 'asistio',
      estadoCivil: 'casado',
      ocupacionId: 2,
      celular: '6681112233',
    });
    expect(state.domicilio.codigoPostalForaneo).toBe('81200');
  });

  it('exige acciones realizadas y tipo de atención', () => {
    const state = initialSeguimientoForm(CTX);
    expect(buildSeguimientoInput(state, OPTS).error).toMatch(/acciones/i);
    expect(buildSeguimientoInput({ ...state, accionesRealizadas: 'Sesión' }, OPTS).error).toMatch(
      /tipo de atención/i,
    );
  });

  it('envía la copia del día y solo adjunta domicilio cuando cambió', () => {
    const base = {
      ...initialSeguimientoForm(CTX),
      accionesRealizadas: 'Sesión',
      tipoAtencionId: 7,
      prioridad: 'alta' as const,
    };

    const sinCambio = buildSeguimientoInput(base, OPTS);
    expect(sinCambio.error).toBeNull();
    expect(sinCambio.input).toMatchObject({
      fichaId: 'f-1',
      citaId: 'c-1',
      tipoAtencionId: 7,
      prioridad: 'alta',
      proximaCitaEn: null,
      copia: { personaId: 'p-1', estadoCivil: 'casado', celular: '6681112233', domicilio: null },
    });

    const conCambio = buildSeguimientoInput(
      { ...base, celular: '6689998877', domicilio: { ...base.domicilio, calle: 'Calle Dos' } },
      OPTS,
    );
    expect(conCambio.input?.copia?.celular).toBe('6689998877');
    expect(conCambio.input?.copia?.domicilio?.calle).toBe('Calle Dos');
  });

  it('solo considera la próxima cita cuando el rol puede agendar (Jurídico)', () => {
    const state = {
      ...initialSeguimientoForm(CTX),
      accionesRealizadas: 'Asesoría',
      tipoAtencionId: 9,
      proximaCitaLocal: '2099-01-15T10:30',
    };
    expect(buildSeguimientoInput(state, OPTS).input?.proximaCitaEn).toBeNull();
    expect(
      buildSeguimientoInput(state, { ...OPTS, permiteAgendar: true }).input?.proximaCitaEn,
    ).toBe('2099-01-15T10:30:00-07:00');
    expect(
      buildSeguimientoInput(
        { ...state, proximaCitaLocal: '2020-01-01T10:00' },
        { ...OPTS, permiteAgendar: true },
      ).error,
    ).toMatch(/futura/);
  });

  it('convierte datetime-local a ISO con desfase de Mazatlán', () => {
    expect(localMazatlanToIso('2026-12-01T09:15')).toBe('2026-12-01T09:15:00-07:00');
    expect(localMazatlanToIso('mañana')).toBeNull();
  });
});
