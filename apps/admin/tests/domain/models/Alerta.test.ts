import { describe, expect, it } from 'vitest';
import {
  ordenarColaAlertas,
  puedeAtenderAlertas,
  puedeVerColaAlertas,
  validarTransicionAlerta,
  validateObservacionesAlerta,
  type ColaAlertaItem,
} from '@/domain/models/Alerta';

function makeAlerta(overrides: Partial<ColaAlertaItem>): ColaAlertaItem {
  return {
    alertaId: 'alr-default',
    origen: 'app_movil',
    prioridad: 'media',
    estado: 'nueva',
    creadoEn: '2026-11-26T10:00:00Z',
    tomadaEn: null,
    atendidaPorNombre: null,
    personaId: null,
    fichaId: null,
    folio: null,
    nombreCompleto: null,
    celular: null,
    tieneOrdenVigente: false,
    asentamientoNombre: null,
    ...overrides,
  };
}

describe('Alerta (reglas RF-20 / RN-16 / RN-17 / SF-12)', () => {
  it('permite transiciones válidas nueva -> tomada -> atendida y rechaza saltos inválidos', () => {
    expect(validarTransicionAlerta('nueva', 'tomada')).toBeNull();
    expect(validarTransicionAlerta('tomada', 'atendida')).toBeNull();

    // Camino no feliz / edge cases
    expect(validarTransicionAlerta('nueva', 'atendida')).toMatch(/no permitida/i);
    expect(validarTransicionAlerta('nueva', 'nueva')).toMatch(/ya se encuentra/i);
    expect(validarTransicionAlerta('atendida', 'tomada')).toMatch(/no permitida/i);
    expect(validarTransicionAlerta('tomada', 'nueva')).toMatch(/no permitida/i);
  });

  it('valida la longitud máxima de observaciones al atender alerta', () => {
    expect(validateObservacionesAlerta(null)).toBeNull();
    expect(validateObservacionesAlerta('  Se brindó atención inmediata  ')).toBeNull();
    expect(validateObservacionesAlerta('a'.repeat(2001))).toMatch(/2000 caracteres/i);
  });

  it('ordena la cola por prioridad (alta -> media -> baja) y luego por fecha ascendente sin mutar el arreglo original', () => {
    const items: ColaAlertaItem[] = [
      makeAlerta({ alertaId: 'baja-1', prioridad: 'baja', creadoEn: '2026-11-26T08:00:00Z' }),
      makeAlerta({ alertaId: 'media-2', prioridad: 'media', creadoEn: '2026-11-26T10:00:00Z' }),
      makeAlerta({ alertaId: 'alta-2', prioridad: 'alta', creadoEn: '2026-11-26T11:00:00Z' }),
      makeAlerta({ alertaId: 'media-1', prioridad: 'media', creadoEn: '2026-11-26T09:00:00Z' }),
      makeAlerta({ alertaId: 'alta-1', prioridad: 'alta', creadoEn: '2026-11-26T09:30:00Z' }),
    ];
    const snapshot = items.map((i) => i.alertaId);

    const ordenadas = ordenarColaAlertas(items);

    expect(ordenadas.map((i) => i.alertaId)).toEqual([
      'alta-1',
      'alta-2',
      'media-1',
      'media-2',
      'baja-1',
    ]);
    expect(items.map((i) => i.alertaId)).toEqual(snapshot);
  });

  it('restringe atención a Línea 24/7 (titular, subdireccion, juridico) y bloquea recepcion/umeca', () => {
    expect(puedeVerColaAlertas('titular')).toBe(true);
    expect(puedeVerColaAlertas('subdireccion')).toBe(true);
    expect(puedeVerColaAlertas('juridico')).toBe(true);
    expect(puedeVerColaAlertas('trabajo_social')).toBe(true);
    expect(puedeVerColaAlertas('psicologia')).toBe(true);
    expect(puedeVerColaAlertas('recepcion')).toBe(false);
    expect(puedeVerColaAlertas('umeca')).toBe(false);
    expect(puedeVerColaAlertas(null)).toBe(false);

    expect(puedeAtenderAlertas('titular')).toBe(true);
    expect(puedeAtenderAlertas('subdireccion')).toBe(true);
    expect(puedeAtenderAlertas('juridico')).toBe(true);
    expect(puedeAtenderAlertas('trabajo_social')).toBe(false);
    expect(puedeAtenderAlertas('psicologia')).toBe(false);
    expect(puedeAtenderAlertas('recepcion')).toBe(false);
    expect(puedeAtenderAlertas('umeca')).toBe(false);
  });
});
