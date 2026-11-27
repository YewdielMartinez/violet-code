import { describe, expect, it } from 'vitest';
import {
  OPCIONES_CONSUMO_DROGA,
  formatConsumoDrogas,
  normalizarConsumoDrogas,
  requiereEspecificacionDroga,
  toggleDroga,
  validarConsumoDrogas,
  type TipoDroga,
} from '@/domain/models/ConsumoDrogas';

describe('ConsumoDrogas', () => {
  it('ofrece «No consume» primero y las demás sustancias', () => {
    expect(OPCIONES_CONSUMO_DROGA[0]).toBe('no_consume');
    expect(OPCIONES_CONSUMO_DROGA).toContain('otra');
  });

  it('permite seleccionar varias sustancias y deseleccionarlas', () => {
    let sel: TipoDroga[] = [];
    sel = toggleDroga(sel, 'marihuana');
    sel = toggleDroga(sel, 'cristal');
    expect(sel).toEqual(['marihuana', 'cristal']);
    sel = toggleDroga(sel, 'marihuana');
    expect(sel).toEqual(['cristal']);
    expect(toggleDroga(sel, 'cristal')).toEqual([]);
  });

  it('«No consume» es excluyente con las demás en ambos sentidos', () => {
    expect(toggleDroga(['marihuana', 'cristal'], 'no_consume')).toEqual(['no_consume']);
    expect(toggleDroga(['no_consume'], 'cocaina')).toEqual(['cocaina']);
  });

  it('la selección vacía es válida (no obligatoria) y normaliza a null', () => {
    expect(validarConsumoDrogas({})).toEqual({});
    expect(validarConsumoDrogas({ drogas: [], especificacionDroga: '' })).toEqual({});
    expect(normalizarConsumoDrogas([], '')).toEqual({ drogas: null, especificacionDroga: null });
    expect(normalizarConsumoDrogas(null, 'x')).toEqual({ drogas: null, especificacionDroga: null });
  });

  it('valida opciones inválidas, combinación con no_consume y longitud', () => {
    expect(validarConsumoDrogas({ drogas: ['x'] }).drogas).toBeTruthy();
    expect(validarConsumoDrogas({ drogas: ['no_consume', 'otra'] }).drogas).toBeTruthy();
    expect(
      validarConsumoDrogas({ especificacionDroga: 'x'.repeat(251) }).especificacionDroga,
    ).toBeTruthy();
  });

  it('la especificación solo aplica con «Otra» y es opcional', () => {
    expect(requiereEspecificacionDroga(['otra'])).toBe(true);
    expect(requiereEspecificacionDroga(['cristal'])).toBe(false);
    expect(normalizarConsumoDrogas(['otra'], '  detalle ')).toEqual({
      drogas: ['otra'],
      especificacionDroga: 'detalle',
    });
    expect(normalizarConsumoDrogas(['otra'], '  ').especificacionDroga).toBeNull();
    expect(normalizarConsumoDrogas(['cristal'], 'detalle').especificacionDroga).toBeNull();
    expect(validarConsumoDrogas({ drogas: ['otra'], especificacionDroga: '' })).toEqual({});
  });

  it('normaliza duplicados y valores desconocidos', () => {
    expect(normalizarConsumoDrogas(['cristal', 'cristal', 'raro'], null).drogas).toEqual(['cristal']);
  });

  it('formatea para mostrar: No consume, lista con Otra(detalle) o sin dato', () => {
    expect(formatConsumoDrogas(['no_consume'])).toBe('No consume');
    expect(formatConsumoDrogas(['marihuana', 'otra'], 'Pegamento')).toBe(
      'Marihuana, Otra (Pegamento)',
    );
    expect(formatConsumoDrogas([])).toBeNull();
    expect(formatConsumoDrogas(null)).toBeNull();
  });
});
