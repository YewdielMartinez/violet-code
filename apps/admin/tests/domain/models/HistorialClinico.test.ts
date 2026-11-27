import { describe, expect, it } from 'vitest';
import {
  citasSinAtencion,
  esMayorDeEdadClinica,
  validarRegistroClinico,
  type AtencionClinica,
  type ExpedienteClinico,
  type RegistroClinicoInput,
} from '@/domain/models/HistorialClinico';

const historial = {
  id: 'historial-1',
  activo: true,
  creadoEn: '2026-11-26T18:00:00Z',
  antecedentesFamiliares: 'Antecedente familiar sintético',
  antecedentesPersonales: 'Antecedente personal sintético',
  motivoConsulta: 'Motivo sintético',
  observacionesIniciales: 'Primera observación sintética',
  tieneAtencionPsicologicaPrevia: false,
};

const atencion: AtencionClinica = {
  id: 'atencion-1',
  citaId: 'cita-1',
  atendidaEn: '2026-11-26T18:00:00Z',
  observaciones: 'Observación anterior sintética',
  tipoAtencionId: 1,
  activo: true,
};

const expediente: ExpedienteClinico = {
  folio: 'SEM-2026-0001',
  puedeRegistrarAtencion: true,
  historial: null,
  atenciones: [atencion],
  citas: [
    { id: 'cita-1', programadaEn: '2026-11-26T18:00:00Z' },
    { id: 'cita-2', programadaEn: '2026-11-26T19:00:00Z' },
  ],
  tiposAtencion: [{ id: 1, nombre: 'Terapia individual' }],
};

const primera = { tipo: 'primera', datos: historial } as const;
const seguimiento = {
  tipo: 'seguimiento',
  visita: { tipo: 'nueva', id: 'atencion-2', citaId: 'cita-2', tipoAtencionId: 1 },
  observacion: 'Observación nueva sintética',
} as const;

describe('registro del historial clínico', () => {
  it('acepta la primera sesión únicamente si aún no hay historial', () => {
    expect(validarRegistroClinico(expediente, primera)).toBeNull();
    expect(validarRegistroClinico({ ...expediente, historial }, primera)).toMatch(/ya existe/i);
    expect(validarRegistroClinico({ ...expediente, historial: { ...historial, activo: false } }, primera)).toMatch(/ya existe/i);
  });

  it('requiere motivo de consulta y valida el límite en caracteres, no en unidades UTF-16', () => {
    const registrar = (motivoConsulta: string) => validarRegistroClinico(expediente, {
      ...primera, datos: { ...historial, motivoConsulta },
    });
    expect(registrar('  ')).toMatch(/motivo de consulta/i);
    expect(registrar('🟣'.repeat(5000))).toBeNull();
    expect(registrar('🟣'.repeat(5001))).toMatch(/5,000/);
  });

  it('requiere un historial activo y una observación no vacía para el seguimiento', () => {
    expect(validarRegistroClinico(expediente, seguimiento)).toMatch(/historial clínico activo/i);
    expect(validarRegistroClinico({ ...expediente, historial }, { ...seguimiento, observacion: ' ' })).toMatch(/observación/i);
    expect(validarRegistroClinico({ ...expediente, historial }, seguimiento)).toBeNull();
  });

  it('deja completar una atención sin nota una sola vez y no crea otra para una cita ocupada', () => {
    const actual = { ...expediente, historial };
    const completar: RegistroClinicoInput = { ...seguimiento, visita: { tipo: 'existente', atencionId: atencion.id } };
    expect(validarRegistroClinico(actual, completar)).toMatch(/ya tiene una observación/i);
    expect(validarRegistroClinico({ ...actual, atenciones: [{ ...atencion, observaciones: null }] }, completar)).toBeNull();
    expect(validarRegistroClinico(actual, { ...seguimiento, visita: { ...seguimiento.visita, citaId: 'cita-1' } })).toMatch(/ya tiene una atención/i);
    expect(citasSinAtencion({ ...actual, atenciones: [{ ...atencion, activo: false }] }).map((c) => c.id)).toEqual(['cita-2']);
  });

  it('admite una atención sin cita con un tipo válido y rechaza referencias de agenda ajenas', () => {
    const actual = { ...expediente, historial };
    expect(validarRegistroClinico(actual, { ...seguimiento, visita: { ...seguimiento.visita, citaId: null } })).toBeNull();
    expect(validarRegistroClinico(actual, { ...seguimiento, visita: { ...seguimiento.visita, citaId: 'ajena' } })).toMatch(/no está disponible/i);
    expect(validarRegistroClinico(actual, { ...seguimiento, visita: { ...seguimiento.visita, tipoAtencionId: 99 } })).toMatch(/tipo de atención/i);
  });

  it('aplica mayoría de edad según el día local de Ahome', () => {
    expect(esMayorDeEdadClinica('2008-11-26', new Date('2026-11-26T06:59:00Z'))).toBe(false);
    expect(esMayorDeEdadClinica('2008-11-26', new Date('2026-11-26T07:00:00Z'))).toBe(true);
    expect(validarRegistroClinico({ ...expediente, puedeRegistrarAtencion: false }, primera)).toMatch(/18 años/);
  });
});
