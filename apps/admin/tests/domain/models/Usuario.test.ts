import { describe, expect, it } from 'vitest';
import {
  INITIAL_USUARIO_FORM,
  rolRequiereArea,
  tipoCuentaDeRol,
  usuarioFormFromCuenta,
  validateUsuarioCuenta,
  validateUsuarioRol,
  type UsuarioCuenta,
  type UsuarioFormInput,
} from '@/domain/models/Usuario';

const VALID: UsuarioFormInput = {
  ...INITIAL_USUARIO_FORM,
  nombre: 'Ana López',
  correo: 'ana.lopez@semujeres.gob.mx',
  contrasena: 'Temporal2026',
  confirmarContrasena: 'Temporal2026',
  rol: 'psicologia',
};

const CUENTA: UsuarioCuenta = {
  id: 'u-1',
  tipo: 'empleado',
  nombre: 'Ana López',
  rol: 'psicologia',
  areaId: 2,
  areaNombre: 'Psicología',
  activo: true,
  creadoEn: '2026-11-01T00:00:00Z',
  actualizadoEn: '2026-11-01T00:00:00Z',
};

describe('validateUsuarioCuenta', () => {
  it('acepta un alta completa', () => {
    expect(validateUsuarioCuenta(VALID, 'create')).toBeNull();
  });

  it('exige nombre', () => {
    expect(validateUsuarioCuenta({ ...VALID, nombre: '  ' }, 'create')?.field).toBe('nombre');
  });

  it('exige correo válido en el alta', () => {
    expect(validateUsuarioCuenta({ ...VALID, correo: 'ana@' }, 'create')?.field).toBe('correo');
  });

  it('exige contraseña de 8+ caracteres con letras y números', () => {
    expect(validateUsuarioCuenta({ ...VALID, contrasena: 'Ab1', confirmarContrasena: 'Ab1' }, 'create')?.field).toBe(
      'contrasena',
    );
    expect(
      validateUsuarioCuenta({ ...VALID, contrasena: 'soloLetras', confirmarContrasena: 'soloLetras' }, 'create')?.field,
    ).toBe('contrasena');
  });

  it('exige que la confirmación coincida', () => {
    expect(validateUsuarioCuenta({ ...VALID, confirmarContrasena: 'Otra2026x' }, 'create')?.field).toBe(
      'confirmarContrasena',
    );
  });

  it('en edición ignora correo y contraseña', () => {
    expect(validateUsuarioCuenta({ ...VALID, correo: '', contrasena: '' }, 'edit')).toBeNull();
  });
});

describe('validateUsuarioRol', () => {
  it('exige un rol', () => {
    expect(validateUsuarioRol({ ...VALID, rol: '' }, null)?.field).toBe('rol');
  });

  it('impide convertir personal en cuenta UMECA y viceversa', () => {
    expect(validateUsuarioRol({ ...VALID, rol: 'umeca' }, CUENTA)?.field).toBe('rol');
    expect(validateUsuarioRol({ ...VALID, rol: 'titular' }, { ...CUENTA, tipo: 'externo', rol: 'umeca' })?.field).toBe(
      'rol',
    );
    expect(validateUsuarioRol({ ...VALID, rol: 'juridico' }, CUENTA)).toBeNull();
  });
});

describe('reglas de rol', () => {
  it('solo las áreas de atención llevan área', () => {
    expect(rolRequiereArea('trabajo_social')).toBe(true);
    expect(rolRequiereArea('juridico')).toBe(true);
    expect(rolRequiereArea('recepcion')).toBe(false);
    expect(rolRequiereArea('titular')).toBe(false);
    expect(rolRequiereArea('')).toBe(false);
  });

  it('UMECA es cuenta externa', () => {
    expect(tipoCuentaDeRol('umeca')).toBe('externo');
    expect(tipoCuentaDeRol('recepcion')).toBe('empleado');
  });

  it('precarga el formulario de edición sin credenciales', () => {
    const form = usuarioFormFromCuenta({ ...CUENTA, activo: false });
    expect(form).toMatchObject({ nombre: 'Ana López', rol: 'psicologia', activo: false, correo: '', contrasena: '' });
  });
});
