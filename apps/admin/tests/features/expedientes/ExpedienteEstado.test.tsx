import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { ExpedienteEstadoCard } from '@/features/expedientes/drawer/ExpedienteEstado';
import { formatFechaCorta, formatTiempoRelativo } from '@/features/expedientes/drawer/formatters';

const BASE: ExpedienteResumen = {
  id: 'e1',
  folio: 'SEM-2026-0001',
  estado: 'en_seguimiento',
  creadoEn: '2026-11-20T10:00:00Z',
  actualizadoEn: '2026-11-25T10:00:00Z',
  enListaUrgencias: false,
  persona: {
    id: 'p1',
    curp: 'MEZA910315MSLGRN04',
    nombres: 'Adriana',
    apellidoPaterno: 'Meza',
    apellidoMaterno: null,
    nombreCompleto: 'Adriana Meza',
    sexo: 'M',
    fechaNacimiento: '1991-03-15',
    entidadNacimiento: 'SL',
    celular: null,
  },
};

afterEach(cleanup);

describe('ExpedienteEstadoCard', () => {
  it('marca la etapa actual y las completadas en el avance', () => {
    render(<ExpedienteEstadoCard expediente={BASE} />);
    const steps = within(screen.getByRole('list', { name: 'Progreso del expediente' })).getAllByRole('listitem');
    expect(steps.map((li) => li.getAttribute('data-status'))).toEqual(['done', 'current', 'todo']);
    expect(steps[1]?.getAttribute('aria-current')).toBe('step');
  });

  it('muestra una nota (sin avance) para expedientes archivados y la prioridad cuando aplica', () => {
    render(<ExpedienteEstadoCard expediente={{ ...BASE, estado: 'archivado', enListaUrgencias: true }} />);
    expect(screen.queryByRole('list', { name: 'Progreso del expediente' })).toBeNull();
    expect(screen.getByText(/Archivado: ya no forma parte/)).toBeTruthy();
    expect(screen.getByText('Urgente')).toBeTruthy();
  });
});

describe('formatters de fecha de estado', () => {
  it('devuelve null con fechas inválidas', () => {
    expect(formatFechaCorta('no-fecha')).toBeNull();
    expect(formatTiempoRelativo('no-fecha')).toBeNull();
  });

  it('expresa el tiempo transcurrido en español', () => {
    const now = Date.parse('2026-11-26T10:00:00Z');
    expect(formatTiempoRelativo('2026-11-23T10:00:00Z', now)).toBe('hace 3 días');
    expect(formatTiempoRelativo('2026-11-26T09:59:50Z', now)).toBe('hace un momento');
  });
});
