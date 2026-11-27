import { describe, expect, it } from 'vitest';
import { INITIAL_FICHA_AGRESOR, type CatalogoOpcion } from '@/domain/models/Agresor';
import { validateStepAgresor } from '@/features/expedientes/ficha/fichaValidation';

const PARENTESCOS: CatalogoOpcion[] = [{ id: 1, clave: 'pareja', nombre: 'Pareja' }];
const OCUPACIONES: CatalogoOpcion[] = [{ id: 2, clave: 'empleado', nombre: 'Empleado' }];

const COMPLETO = {
  ...INITIAL_FICHA_AGRESOR,
  nombres: 'Carlos',
  apellidoPaterno: 'Méndez',
  parentescoId: 1,
  ocupacionId: 2,
};

describe('validateStepAgresor · parentesco y ocupación obligatorios', () => {
  it('con la sección vacía permite continuar', () => {
    expect(validateStepAgresor(INITIAL_FICHA_AGRESOR, PARENTESCOS, OCUPACIONES)).toBeNull();
  });

  it('con todos los obligatorios capturados es válido', () => {
    expect(validateStepAgresor(COMPLETO, PARENTESCOS, OCUPACIONES)).toBeNull();
  });

  it('si se captura cualquier dato exige parentesco y ocupación', () => {
    const result = validateStepAgresor(
      { ...INITIAL_FICHA_AGRESOR, nombres: 'Carlos', apellidoPaterno: 'Méndez' },
      PARENTESCOS,
      OCUPACIONES,
    );
    expect(result?.errors.parentescoId).toBe('El parentesco con la usuaria es obligatorio.');
    expect(result?.errors.ocupacionId).toBe('La ocupación de la persona agresora es obligatoria.');
    expect(result?.failure.field).toBe('agresor-parentescoId');
  });

  it('señala la ocupación cuando solo falta ella', () => {
    const result = validateStepAgresor({ ...COMPLETO, ocupacionId: null }, PARENTESCOS, OCUPACIONES);
    expect(result?.failure.field).toBe('agresor-ocupacionId');
    expect(result?.errors.parentescoId).toBeUndefined();
  });

  it('un dato suelto (p. ej. solo una observación) también activa los obligatorios', () => {
    const result = validateStepAgresor(
      { ...INITIAL_FICHA_AGRESOR, observaciones: 'Algo' },
      PARENTESCOS,
      OCUPACIONES,
    );
    expect(result?.errors.parentescoId).toBeTruthy();
    expect(result?.errors.ocupacionId).toBeTruthy();
  });
});
