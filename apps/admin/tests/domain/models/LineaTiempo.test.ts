import { describe, expect, it } from 'vitest';
import {
  contarPorTipo,
  estadoCrudoDesdeTitulo,
  humanizarTitulo,
  mapLineaTiempo,
  ordenarLineaTiempo,
  TIPO_ICON,
  TIPOS_LINEA_TIEMPO,
} from '@/domain/models/LineaTiempo';
import { normalizarTipoEvento, type LineaTiempoEvento } from '@/domain/models/Seguimiento';

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

  it('muestra cada cambio de estado de una orden como «Orden de protección: anterior → nuevo»', () => {
    const [cancelada, vencida] = mapLineaTiempo(
      [
        evento({
          fecha: '2026-11-22T16:00:00Z',
          tipo: 'orden_proteccion',
          area: null,
          titulo: 'Orden de protección: vigente → cancelada',
          detalle: 'Por Ana López — Revocada por el juzgado',
          referenciaId: 'oe-2',
        }),
        evento({
          fecha: '2026-11-21T16:00:00Z',
          tipo: 'orden_proteccion',
          area: null,
          titulo: 'Orden de protección: en_tramite → vencida',
          referenciaId: 'oe-1',
        }),
      ],
      null,
      NOW,
    );
    expect(cancelada).toMatchObject({
      id: 'orden_proteccion-oe-2',
      title: 'Orden de protección: Vigente → Cancelada',
      description: 'Por Ana López — Revocada por el juzgado',
      status: 'error',
    });
    expect(vencida).toMatchObject({
      title: 'Orden de protección: En trámite → Vencida',
      status: 'done',
    });
    expect(estadoCrudoDesdeTitulo('Orden de protección: en_tramite → vigente')).toBe('vigente');
  });

  it('cuenta eventos por tipo para los filtros', () => {
    expect(contarPorTipo(EVENTOS)).toEqual({
      cita: 2,
      atencion: 1,
      derivacion: 1,
      canalizacion_evento: 0,
      orden_proteccion: 1,
      alerta: 0,
      registro: 1,
      archivo: 0,
      reapertura: 0,
      otro: 0,
    });
  });

  it('muestra canalización, archivo y reapertura que devuelve el RPC', () => {
    const vista = mapLineaTiempo(
      [
        evento({
          fecha: '2026-11-24T16:00:00Z',
          tipo: 'canalizacion_evento',
          area: 'Jurídico',
          titulo: 'Canalización a Jurídico: en_proceso → concluida',
          detalle: 'Se entregó oficio',
          referenciaId: 'ce-1',
        }),
        evento({
          fecha: '2026-11-23T16:00:00Z',
          tipo: 'archivo',
          area: null,
          titulo: 'Archivo de expediente SEM-2026-0001',
          detalle: 'Caso concluido',
          referenciaId: 'f-1',
        }),
        evento({
          fecha: '2026-11-25T16:00:00Z',
          tipo: 'reapertura',
          area: null,
          titulo: 'Reapertura de expediente SEM-2026-0001',
          detalle: 'Nueva agresión',
          referenciaId: 'f-1',
        }),
      ],
      null,
      NOW,
    );
    expect(vista.map((e) => e.id)).toEqual(['reapertura-f-1', 'canalizacion_evento-ce-1', 'archivo-f-1']);
    expect(vista[0]).toMatchObject({ icon: 'autorenew', status: 'current', description: 'Nueva agresión' });
    expect(vista[1]).toMatchObject({
      title: 'Canalización a Jurídico: En proceso → Concluida',
      status: 'done',
      icon: 'alt_route',
      meta: 'Jurídico',
    });
    expect(vista[2]).toMatchObject({ icon: 'archive', status: 'done', title: 'Archivo de expediente SEM-2026-0001' });
    const filtrada = mapLineaTiempo(
      [evento({ tipo: 'canalizacion_evento', titulo: 'Canalización a X: pendiente → cancelada' })],
      new Set(['canalizacion_evento'] as const),
      NOW,
    );
    expect(filtrada[0].status).toBe('error');
  });

  it('renderiza genérico un tipo futuro desconocido y sigue descartando notas privadas', () => {
    const futuro = { ...evento({ referenciaId: 'x-1', titulo: 'Evento nuevo' }), tipo: 'visita_domiciliaria' as never };
    const nota = { ...evento({ referenciaId: 'n-1' }), tipo: 'nota_privada' as never };
    const vista = mapLineaTiempo([futuro, nota], null, NOW);
    expect(vista).toHaveLength(1);
    expect(vista[0]).toMatchObject({ tipo: 'otro', title: 'Evento nuevo', icon: 'circle', id: 'otro-x-1' });
    expect(contarPorTipo([futuro, nota]).otro).toBe(1);
    expect(normalizarTipoEvento('alerta')).toBe('alerta');
    expect(normalizarTipoEvento('nota_area')).toBeNull();
    expect(normalizarTipoEvento('algo_nuevo')).toBe('otro');
  });

  it('usa un nombre de icono Material Symbols por tipo (sin letras sueltas)', () => {
    for (const tipo of TIPOS_LINEA_TIEMPO) expect(TIPO_ICON[tipo]).toMatch(/^[a-z][a-z_]{2,}$/);
    expect(TIPO_ICON).toMatchObject({
      registro: 'description',
      cita: 'event',
      atencion: 'clinical_notes',
      derivacion: 'alt_route',
      canalizacion_evento: 'alt_route',
      orden_proteccion: 'gavel',
      alerta: 'sos',
      archivo: 'archive',
      reapertura: 'autorenew',
      otro: 'circle',
    });
  });
});
