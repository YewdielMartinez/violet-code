import { describe, expect, it } from 'vitest';
import {
  validarTransicionAlerta,
  validateObservacionesAlerta,
} from '@/domain/models/Alerta';

describe('Alerta (reglas RF-20 / RN-16 / SF-12)', () => {
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
});
