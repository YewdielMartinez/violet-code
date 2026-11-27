import { describe, expect, it } from 'vitest';
import {
  FILTROS_INICIALES,
  aIsoMazatlan,
  agruparActividadesPorDia,
  construirFiltrosServidor,
  diaMazatlan,
  filtrarActividades,
  horaActividad,
  mensajeError,
  ubicacionActividad,
} from '@/features/actividades/actividadesList';
import { act } from './fixtures';

// Jueves 3 dic 2026, 10:00 en Mazatlán (UTC-7).
const AHORA = new Date('2026-12-03T17:00:00Z');

describe('construirFiltrosServidor', () => {
  it('pendientes pide desde ahora; realizadas, hasta ahora; todas, sin límites', () => {
    expect(construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'pendientes' }, AHORA)).toEqual({
      desde: AHORA.toISOString(),
      hasta: null,
      limite: 200,
    });
    expect(construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'realizadas' }, AHORA)).toEqual({
      desde: null,
      hasta: AHORA.toISOString(),
      limite: 200,
    });
    expect(construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'todas' }, AHORA)).toEqual({
      desde: null,
      hasta: null,
      limite: 200,
    });
  });

  it('el rango se interpreta en hora de Mazatlán y se combina con la frontera de la pestaña', () => {
    const r = construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'todas', desde: '2026-12-01', hasta: '2026-12-31' }, AHORA);
    expect(r?.desde).toBe('2026-12-01T07:00:00.000Z');
    expect(r?.hasta).toBe('2027-01-01T06:59:59.999Z');

    const pend = construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'pendientes', desde: '2026-11-01' }, AHORA);
    expect(pend?.desde).toBe(AHORA.toISOString());
  });

  it('devuelve null si el rango no puede tener resultados (evita el error del RPC)', () => {
    expect(construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'pendientes', hasta: '2026-11-01' }, AHORA)).toBeNull();
    expect(construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'realizadas', desde: '2026-12-20' }, AHORA)).toBeNull();
    expect(
      construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'todas', desde: '2026-12-20', hasta: '2026-12-01' }, AHORA),
    ).toBeNull();
  });
});

describe('filtrarActividades', () => {
  const items = [
    act('1', '2026-12-10T17:00:00Z', { sede: 'Escuela Benito Juárez', asentamientoNombre: 'Centro', municipio: 'Ahome' }),
    act('2', '2026-11-20T17:00:00Z', { sede: 'Ingenio Central', tipoInstitucion: 'empresa_privada' }),
  ];

  it('separa pendientes y realizadas por la fecha', () => {
    expect(filtrarActividades(items, { ...FILTROS_INICIALES, tab: 'pendientes' }, AHORA).map((a) => a.id)).toEqual(['1']);
    expect(filtrarActividades(items, { ...FILTROS_INICIALES, tab: 'realizadas' }, AHORA).map((a) => a.id)).toEqual(['2']);
    expect(filtrarActividades(items, { ...FILTROS_INICIALES, tab: 'todas' }, AHORA)).toHaveLength(2);
  });

  it('busca por institución o lugar sin distinguir mayúsculas ni acentos', () => {
    const todas = { ...FILTROS_INICIALES, tab: 'todas' as const };
    expect(filtrarActividades(items, { ...todas, busqueda: 'JUAREZ' }, AHORA).map((a) => a.id)).toEqual(['1']);
    expect(filtrarActividades(items, { ...todas, busqueda: 'ahome' }, AHORA).map((a) => a.id)).toEqual(['1']);
    expect(filtrarActividades(items, { ...todas, busqueda: 'nada' }, AHORA)).toEqual([]);
  });

  it('filtra por tipo de institución', () => {
    const todas = { ...FILTROS_INICIALES, tab: 'todas' as const };
    expect(filtrarActividades(items, { ...todas, tipoInstitucion: 'empresa_privada' }, AHORA).map((a) => a.id)).toEqual(['2']);
  });
});

describe('agruparActividadesPorDia', () => {
  it('pone primero lo pendiente (próximo a lejano) y luego lo realizado (reciente a antiguo)', () => {
    const grupos = agruparActividadesPorDia(
      [
        act('lejana', '2026-12-20T17:00:00Z'),
        act('pasada-vieja', '2026-11-01T17:00:00Z'),
        act('hoy-tarde', '2026-12-03T22:00:00Z'),
        act('manana', '2026-12-04T17:00:00Z'),
        act('pasada-reciente', '2026-12-02T17:00:00Z'),
      ],
      AHORA,
    );
    expect(grupos.map((g) => g.items[0].id)).toEqual(['hoy-tarde', 'manana', 'lejana', 'pasada-reciente', 'pasada-vieja']);
    expect(grupos.map((g) => g.estado)).toEqual(['pendiente', 'pendiente', 'pendiente', 'realizada', 'realizada']);
    expect(grupos[0].etiqueta).toBe('Hoy');
    expect(grupos[1].etiqueta).toBe('Mañana');
    expect(grupos[2].etiqueta).toBe('Domingo 20 de diciembre');
  });

  it('agrupa por día, ordena por hora y separa lo pendiente de lo ya realizado de hoy', () => {
    const grupos = agruparActividadesPorDia(
      [act('noche', '2026-12-04T01:00:00Z'), act('tarde', '2026-12-03T22:00:00Z'), act('temprano', '2026-12-03T15:00:00Z')],
      AHORA,
    );
    expect(grupos.map((g) => [g.estado, g.items.map((a) => a.id)])).toEqual([
      ['pendiente', ['tarde', 'noche']],
      ['realizada', ['temprano']],
    ]);
  });
});

describe('formatos de fecha en Mazatlán', () => {
  it('toma el día y la hora de Mazatlán aunque el navegador esté en otra zona', () => {
    expect(diaMazatlan('2026-12-04T01:00:00Z')).toBe('2026-12-03');
    expect(horaActividad('2026-12-03T17:30:00Z')).toBe('10:30');
  });

  it('convierte la hora de pared a ISO con UTC-7', () => {
    expect(aIsoMazatlan(new Date(2026, 11, 3, 9, 5))).toBe('2026-12-03T09:05:00-07:00');
  });

  it('une colonia y municipio, o devuelve null', () => {
    expect(ubicacionActividad({ asentamientoNombre: 'Centro', municipio: 'Ahome' })).toBe('Centro, Ahome');
    expect(ubicacionActividad({ asentamientoNombre: null, municipio: null })).toBeNull();
  });

  it('traduce errores de permisos y conserva el mensaje del backend', () => {
    expect(mensajeError({ code: '42501', message: 'x' }, 'f')).toMatch(/permiso/);
    expect(mensajeError({ code: '23514', message: 'La sede es obligatoria' }, 'f')).toBe('La sede es obligatoria');
    expect(mensajeError(null, 'fallback')).toBe('fallback');
  });
});
