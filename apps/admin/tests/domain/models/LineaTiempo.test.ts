import { describe, expect, it } from 'vitest';
import {
  contarPorTipo,
  estadoCrudoDesdeTitulo,
  humanizarTitulo,
  mapLineaTiempo,
  ordenarLineaTiempo,
} from '@/domain/models/LineaTiempo';
import type { LineaTiempoEvento } from '@/domain/models/Seguimiento';

const NOW = new Date('2026-11-26T18:00:00Z');

function evento(partial: Partial<LineaTiempoEvento>): LineaTiempoEvento {
  return {
    fecha: '2026-11-20T16:00:00Z',
    tipo: 'cita',
    area: 'Psicología',
    titulo: 'Cita Psicología · agendada',
    detalle: null,
    referenciaId: 'ref-1',
    ...partial,
  };
}

const EVENTOS: LineaTiempoEvento[] = [
  evento({
    fecha: '2026-10-01T15:00:00Z',
    tipo: 'registro',
    area: null,
    titulo: 'Registro de ficha SEM-2026-0001 · en_seguimiento',
    referenciaId: 'f-1',
  }),
  evento({ fecha: '2026-11-25T16:00:00Z', titulo: 'Cita Psicología · asistio', referenciaId: 'c-1' }),
  evento({
    fecha: '2026-11-25T17:00:00Z',
    tipo: 'atencion',
    titulo: 'Atención Psicología · Sesión de seguimiento',
    detalle: 'Se trabajó plan de seguridad',
    referenciaId: 'a-1',
  }),
  evento({
    fecha: '2026-11-10T16:00:00Z',
    tipo: 'derivacion',
    area: 'Trabajo Social',
    titulo: 'Derivación a refugio · en_proceso',
    referenciaId: 'd-1',
  }),
  evento({
    fecha: '2026-11-12T16:00:00Z',
    tipo: 'orden_proteccion',
    area: null,
    titulo: 'Orden de protección · vigente',
    referenciaId: 'o-1',
  }),
  evento({ fecha: '2026-12-02T16:00:00Z', titulo: 'Cita Psicología · confirmada', referenciaId: 'c-2' }),
];

describe('LineaTiempo (RF-25, RN-09)', () => {
  it('ordena del evento más reciente al más antiguo con desempate estable', () => {
    const ordenados = ordenarLineaTiempo([
      evento({ fecha: '2026-11-01T00:00:00Z', tipo: 'cita', referenciaId: 'b' }),
      evento({ fecha: '2026-11-03T00:00:00Z', referenciaId: 'c' }),
      evento({ fecha: '2026-11-01T00:00:00Z', tipo: 'atencion', referenciaId: 'a' }),
    ]);
    expect(ordenados.map((e) => e.referenciaId)).toEqual(['c', 'a', 'b']);
  });

  it('unifica citas, atenciones, derivaciones y órdenes en eventos legibles', () => {
    const vista = mapLineaTiempo(EVENTOS, null, NOW);
    expect(vista.map((e) => e.id)).toEqual([
      'cita-c-2',
      'atencion-a-1',
      'cita-c-1',
      'orden_proteccion-o-1',
      'derivacion-d-1',
      'registro-f-1',
    ]);
    expect(vista[0]).toMatchObject({
      title: 'Cita Psicología · Confirmada',
      status: 'upcoming',
      meta: 'Psicología',
    });
    expect(vista[1]).toMatchObject({
      title: 'Atención Psicología · Sesión de seguimiento',
      description: 'Se trabajó plan de seguridad',
      status: 'done',
    });
    expect(vista[2]).toMatchObject({ title: 'Cita Psicología · Asistió', status: 'done' });
    expect(vista[3]).toMatchObject({ title: 'Orden de protección · Vigente', status: 'current' });
    expect(vista[4].title).toBe('Derivación a Refugio · En proceso');
    expect(vista[5].title).toBe('Registro de ficha SEM-2026-0001 · En seguimiento');
  });

  it('filtra por tipo y descarta tipos desconocidos (las notas privadas nunca aparecen)', () => {
    const conNota = [
      ...EVENTOS,
      { ...evento({ referenciaId: 'n-1' }), tipo: 'nota_area' as LineaTiempoEvento['tipo'] },
    ];
    expect(mapLineaTiempo(conNota, null, NOW).some((e) => e.id.startsWith('nota'))).toBe(false);

    const soloCitas = mapLineaTiempo(conNota, new Set(['cita'] as const), NOW);
    expect(soloCitas).toHaveLength(2);
    expect(soloCitas.every((e) => e.tipo === 'cita')).toBe(true);
  });

  it('marca citas pasadas sin cerrar como actuales y las inasistencias como error', () => {
    const [pasada, falta] = mapLineaTiempo(
      [
        evento({ fecha: '2026-11-26T15:00:00Z', titulo: 'Cita Psicología · agendada', referenciaId: 'x' }),
        evento({ fecha: '2026-11-20T15:00:00Z', titulo: 'Cita Psicología · no_asistio', referenciaId: 'y' }),
      ],
      null,
      NOW,
    );
    expect(pasada.status).toBe('current');
    expect(falta).toMatchObject({ status: 'error', title: 'Cita Psicología · No asistió' });
  });

  it('extrae el estado crudo del título, incluidas las alertas', () => {
    expect(estadoCrudoDesdeTitulo('Alerta app_movil · alta (nueva)')).toBe('nueva');
    expect(estadoCrudoDesdeTitulo('Cita Jurídico · cancelada')).toBe('cancelada');
    expect(estadoCrudoDesdeTitulo('Atención Psicología · Entrevista inicial')).toBeNull();
    expect(humanizarTitulo('Alerta app_movil · alta (nueva)')).toBe(
      'Alerta App móvil · prioridad alta (Nueva)',
    );
  });

  it('cuenta eventos por tipo para los filtros', () => {
    expect(contarPorTipo(EVENTOS)).toEqual({
      cita: 2,
      atencion: 1,
      derivacion: 1,
      orden_proteccion: 1,
      alerta: 0,
      registro: 1,
    });
  });
});
