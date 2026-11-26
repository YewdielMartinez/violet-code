import { describe, expect, it } from 'vitest';
import { availableWidgets } from './layout';

describe('dashboard widgets by role', () => {
  it('reserva security exclusivamente para titular y subdirección', () => {
    expect(availableWidgets('titular').some((w) => w.id === 'security')).toBe(true);
    expect(availableWidgets('subdireccion').some((w) => w.id === 'security')).toBe(true);
    expect(availableWidgets('trabajo_social').some((w) => w.id === 'security')).toBe(false);
    expect(availableWidgets('psicologia').some((w) => w.id === 'security')).toBe(false);
    expect(availableWidgets('recepcion').some((w) => w.id === 'security')).toBe(false);
  });

  it('oculta alertas, expedientes y tendencias a recepción', () => {
    const ids = availableWidgets('recepcion').map((w) => w.id);
    expect(ids).toEqual(['kpis', 'agenda', 'directory']);
  });
});
