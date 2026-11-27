import { describe, expect, it } from 'vitest';
import {
  FILTROS_INICIALES,
  TAB_ESTADO,
  aIsoMazatlan,
  agruparActividadesPorDia,
  construirFiltrosServidor,
  diaMazatlan,
  filtrarActividades,
  hayFiltrosActivos,
  horaActividad,
  mensajeError,
  ubicacionActividad,
} from '@/features/actividades/actividadesList';
import { act } from './fixtures';

// Jueves 3 dic 2026, 10:00 en Mazatlán (UTC-7).
const AHORA = new Date('2026-12-03T17:00:00Z');

describe('construirFiltrosServidor', () => {
  it('cada pestaña pide su estado al servidor; «Todas» no filtra', () => {
    expect(construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'pendientes' })).toEqual({
      desde: null,
      hasta: null,
      estado: 'pendiente',
      limite: 200,
    });
    expect(construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'realizadas' })?.estado).toBe('realizada');
    expect(construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'canceladas' })?.estado).toBe('cancelada');
    expect(construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'todas' })?.estado).toBeNull();
  });

  it('el estado de las pestañas ya no depende de la fecha ni del reloj', () => {
    expect(TAB_ESTADO).toEqual({ pendientes: 'pendiente', realizadas: 'realizada', canceladas: 'cancelada', todas: null });
  });

  it('el rango se interpreta en hora de Mazatlán', () => {
    const r = construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'todas', desde: '2026-12-01', hasta: '2026-12-31' });
    expect(r?.desde).toBe('2026-12-01T07:00:00.000Z');
    expect(r?.hasta).toBe('2027-01-01T06:59:59.999Z');

    const soloDesde = construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'pendientes', desde: '2026-11-01' });
    expect(soloDesde).toMatchObject({ desde: '2026-11-01T07:00:00.000Z', hasta: null, estado: 'pendiente' });
  });

  it('devuelve null si el rango no puede tener resultados (evita el error del RPC)', () => {
    expect(
      construirFiltrosServidor({ ...FILTROS_INICIALES, tab: 'todas', desde: '2026-12-20', hasta: '2026-12-01' }),
    ).toBeNull();
  });
});

describe('filtrarActividades', () => {
  const items = [
    act('1', '2026-12-10T17:00:00Z', { sede: 'Escuela Benito Juárez', asentamientoNombre: 'Centro', municipio: 'Ahome' }),
    act('2', '2026-11-20T17:00:00Z', { sede: 'Ingenio Central', tipoInstitucion: 'empresa_privada', estado: 'realizada' }),
    act('3', '2026-11-22T17:00:00Z', { sede: 'Parque Sinaloa', tipoInstitucion: 'comunidad', estado: 'cancelada' }),
  ];

  it('separa las pestañas por el estado real, no por la fecha', () => {
    const ids = (tab: 'pendientes' | 'realizadas' | 'canceladas' | 'todas') =>
      filtrarActividades(items, { ...FILTROS_INICIALES, tab }).map((a) => a.id);
    expect(ids('pendientes')).toEqual(['1']);
    expect(ids('realizadas')).toEqual(['2']);
    expect(ids('canceladas')).toEqual(['3']);
    expect(ids('todas')).toEqual(['1', '2', '3']);
  });

  it('una pendiente con fecha pasada sigue en «Pendientes»', () => {
    const vencida = act('v', '2026-11-01T17:00:00Z');
    expect(filtrarActividades([vencida], { ...FILTROS_INICIALES, tab: 'pendientes' }).map((a) => a.id)).toEqual(['v']);
    expect(filtrarActividades([vencida], { ...FILTROS_INICIALES, tab: 'realizadas' })).toEqual([]);
  });

  it('busca por institución o lugar sin distinguir mayúsculas ni acentos', () => {
    const todas = { ...FILTROS_INICIALES, tab: 'todas' as const };
    expect(filtrarActividades(items, { ...todas, busqueda: 'JUAREZ' }).map((a) => a.id)).toEqual(['1']);
    expect(filtrarActividades(items, { ...todas, busqueda: 'ahome' }).map((a) => a.id)).toEqual(['1']);
    expect(filtrarActividades(items, { ...todas, busqueda: 'nada' })).toEqual([]);
  });

  it('filtra por tipo de institución', () => {
    const todas = { ...FILTROS_INICIALES, tab: 'todas' as const };
    expect(filtrarActividades(items, { ...todas, tipoInstitucion: 'empresa_privada' }).map((a) => a.id)).toEqual(['2']);
  });
});

describe('hayFiltrosActivos', () => {
  it('ignora la pestaña y detecta búsqueda, institución y fechas', () => {
    expect(hayFiltrosActivos({ ...FILTROS_INICIALES, tab: 'canceladas' })).toBe(false);
    expect(hayFiltrosActivos({ ...FILTROS_INICIALES, busqueda: 'x' })).toBe(true);
    expect(hayFiltrosActivos({ ...FILTROS_INICIALES, tipoInstitucion: 'escuela' })).toBe(true);
    expect(hayFiltrosActivos({ ...FILTROS_INICIALES, desde: '2026-12-01' })).toBe(true);
    expect(hayFiltrosActivos({ ...FILTROS_INICIALES, hasta: '2026-12-01' })).toBe(true);
  });
});

describe('agruparActividadesPorDia', () => {
  it('pone primero lo pendiente (próximo a lejano), luego lo realizado y lo cancelado (reciente a antiguo)', () => {
    const grupos = agruparActividadesPorDia(
      [
        act('lejana', '2026-12-20T17:00:00Z'),
        act('realizada-vieja', '2026-11-01T17:00:00Z', { estado: 'realizada' }),
        act('hoy-tarde', '2026-12-03T22:00:00Z'),
        act('manana', '2026-12-04T17:00:00Z'),
        act('realizada-reciente', '2026-12-02T17:00:00Z', { estado: 'realizada' }),
        act('cancelada', '2026-12-01T17:00:00Z', { estado: 'cancelada' }),
      ],
      AHORA,
    );
    expect(grupos.map((g) => g.items[0].id)).toEqual([
      'hoy-tarde',
      'manana',
      'lejana',
      'realizada-reciente',
      'realizada-vieja',
      'cancelada',
    ]);
    expect(grupos.map((g) => g.estado)).toEqual(['pendiente', 'pendiente', 'pendiente', 'realizada', 'realizada', 'cancelada']);
    expect(grupos[0].etiqueta).toBe('Hoy');
    expect(grupos[1].etiqueta).toBe('Mañana');
    expect(grupos[2].etiqueta).toBe('Domingo 20 de diciembre');
  });

  it('las pendientes vencidas quedan arriba, antes de las próximas', () => {
    const grupos = agruparActividadesPorDia(
      [act('proxima', '2026-12-05T17:00:00Z'), act('vencida', '2026-11-28T17:00:00Z')],
      AHORA,
    );
    expect(grupos.map((g) => g.items[0].id)).toEqual(['vencida', 'proxima']);
  });

  it('agrupa por día y estado, y ordena por hora dentro del día', () => {
    const grupos = agruparActividadesPorDia(
      [
        act('noche', '2026-12-04T01:00:00Z'),
        act('tarde', '2026-12-03T22:00:00Z'),
        act('temprano', '2026-12-03T15:00:00Z', { estado: 'realizada' }),
        act('tarde-2', '2026-12-03T20:00:00Z'),
      ],
      AHORA,
    );
    expect(grupos.map((g) => [g.estado, g.items.map((a) => a.id)])).toEqual([
      ['pendiente', ['tarde-2', 'tarde', 'noche']],
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
