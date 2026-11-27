import { describe, expect, it } from 'vitest';
import { normalizarTelefono, validarCambioContrasena, validarMiPerfil } from '@/domain/models/Perfil';

describe('normalizarTelefono', () => {
  it('quita espacios, guiones, puntos y paréntesis', () => {
    expect(normalizarTelefono('(667) 123-45.67')).toBe('6671234567');
  });
});

describe('validarMiPerfil', () => {
  it('exige nombre y limita su longitud', () => {
    expect(validarMiPerfil({ nombre: '  ', telefono: '' })?.field).toBe('nombre');
    expect(validarMiPerfil({ nombre: 'a'.repeat(121), telefono: '' })?.field).toBe('nombre');
  });

  it('acepta teléfono vacío o de 10 dígitos y rechaza otro formato', () => {
    expect(validarMiPerfil({ nombre: 'Ana', telefono: '' })).toBeNull();
    expect(validarMiPerfil({ nombre: 'Ana', telefono: '667 123 4567' })).toBeNull();
    expect(validarMiPerfil({ nombre: 'Ana', telefono: '12345' })).toMatchObject({ field: 'telefono' });
  });
});

describe('validarCambioContrasena', () => {
  const ok = { actual: 'Vieja1234', nueva: 'Nueva1234', confirmar: 'Nueva1234' };

  it('acepta una contraseña válida', () => {
    expect(validarCambioContrasena(ok)).toBeNull();
  });

  it('exige la contraseña actual', () => {
    expect(validarCambioContrasena({ ...ok, actual: '' })?.field).toBe('actual');
  });

  it('exige 8 caracteres con letras y números', () => {
    expect(validarCambioContrasena({ ...ok, nueva: 'Ab1', confirmar: 'Ab1' })?.field).toBe('nueva');
    expect(validarCambioContrasena({ ...ok, nueva: 'sololetras', confirmar: 'sololetras' })?.error).toMatch(
      /letras y números/,
    );
    expect(validarCambioContrasena({ ...ok, nueva: '1234567890', confirmar: '1234567890' })?.field).toBe('nueva');
  });

  it('rechaza una nueva igual a la actual y una confirmación distinta', () => {
    expect(
      validarCambioContrasena({ actual: 'Misma1234', nueva: 'Misma1234', confirmar: 'Misma1234' })?.error,
    ).toMatch(/distinta/);
    expect(validarCambioContrasena({ ...ok, confirmar: 'Otra12345' })).toMatchObject({ field: 'confirmar' });
  });
});
