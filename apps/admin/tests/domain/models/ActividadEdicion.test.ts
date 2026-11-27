import { describe, expect, it } from 'vitest';
import {
  aplicarEdicionActividad,
  camposEditados,
  validateActividadActualizar,
  type ActividadEdicionVista,
  type ActividadPreventivaUpdateInput,
} from '@/domain/models/ActividadEdicion';
import { act } from '../../features/actividades/fixtures';

const INPUT: ActividadPreventivaUpdateInput = {
  actividadId: 'a1',
  actualizadoEn: '2026-11-20T00:00:00+00:00',
  titulo: '  Nuevo título ',
  tipoActividadId: 2,
  tipoInstitucion: 'comunidad',
  nivelEducativo: 'primaria',
  sede: ' Parque ',
  direccion: '  ',
  referencias: 'Frente a la cancha',
  asentamientoId: 7,
  programadaEn: '2026-12-10T09:00:00-07:00',
  numeroAsistentes: 40,
  participantesIds: ['e1'],
};

const VISTA: ActividadEdicionVista = {
  tipoActividadClave: 'conferencia',
  tipoActividadNombre: 'Conferencia',
  asentamientoNombre: 'Centro',
  codigoPostal: '81200',
  municipio: 'Ahome',
  participantes: [{ empleadoId: 'e1', nombre: 'Laura', rol: 'psicologia' }],
};

describe('validateActividadActualizar', () => {
  it('acepta una edición válida', () => {
    expect(validateActividadActualizar({ ...INPUT, nivelEducativo: null })).toBeNull();
  });

  it('exige identificador y versión (bloqueo optimista)', () => {
    expect(validateActividadActualizar({ ...INPUT, nivelEducativo: null, actividadId: '' })).toMatch(/identificó/);
    expect(validateActividadActualizar({ ...INPUT, nivelEducativo: null, actualizadoEn: '' })).toMatch(/versión/);
  });

  it('reutiliza las reglas del alta (título, nivel educativo solo en escuela, asistentes)', () => {
    expect(validateActividadActualizar({ ...INPUT, nivelEducativo: null, titulo: '   ' })).toMatch(/título/i);
    expect(validateActividadActualizar(INPUT)).toMatch(/nivel educativo/i);
    expect(validateActividadActualizar({ ...INPUT, nivelEducativo: null, numeroAsistentes: 10001 })).toMatch(/asistentes/);
  });
});

describe('aplicarEdicionActividad', () => {
  const base = act('a1', '2026-12-04T17:00:00Z', { estado: 'pendiente', nivelEducativo: 'secundaria', tipoInstitucion: 'escuela' });

  it('proyecta los campos editados, recorta texto y conserva el estado', () => {
    const r = aplicarEdicionActividad(base, INPUT, VISTA, '2026-12-03T18:00:00+00:00');
    expect(r).toMatchObject({
      id: 'a1',
      titulo: 'Nuevo título',
      sede: 'Parque',
      direccion: null,
      referencias: 'Frente a la cancha',
      tipoActividadNombre: 'Conferencia',
      asentamientoId: 7,
      asentamientoNombre: 'Centro',
      numeroAsistentes: 40,
      estado: 'pendiente',
      actualizadoEn: '2026-12-03T18:00:00+00:00',
      participantes: [{ empleadoId: 'e1', nombre: 'Laura', rol: 'psicologia' }],
    });
    // El nivel educativo solo aplica a escuelas.
    expect(r.nivelEducativo).toBeNull();
  });

  it('sin actualizadoEn nuevo conserva el de la actividad', () => {
    expect(aplicarEdicionActividad(base, INPUT, VISTA).actualizadoEn).toBe(base.actualizadoEn);
  });

  it('camposEditados no incluye el estado ni los datos de cierre', () => {
    const campos = camposEditados(aplicarEdicionActividad(base, INPUT, VISTA));
    expect(campos).toHaveProperty('titulo', 'Nuevo título');
    expect(campos).not.toHaveProperty('estado');
    expect(campos).not.toHaveProperty('realizadaEn');
    expect(campos).not.toHaveProperty('id');
  });
});
