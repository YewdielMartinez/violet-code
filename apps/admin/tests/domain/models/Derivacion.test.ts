import { describe, expect, it } from 'vitest';
import { isInternalDestino, validateDerivacion } from '@/domain/models/Derivacion';

describe('Derivacion (reglas RF-08 / CHECK)', () => {
  it('distingue destinos internos de externos', () => {
    expect(isInternalDestino('psicologia')).toBe(true);
    expect(isInternalDestino('juridico')).toBe(true);
    expect(isInternalDestino('trabajo_social')).toBe(true);
    expect(isInternalDestino('fiscalia')).toBe(false);
    expect(isInternalDestino('refugio')).toBe(false);
    expect(isInternalDestino('otra_institucion')).toBe(false);
  });

  it('exige areaDestinoId en derivación interna sin institución externa', () => {
    expect(
      validateDerivacion({
        fichaId: 'ficha-1',
        areaOrigenId: 1,
        destino: 'psicologia',
        areaDestinoId: null,
        institucionId: null,
        institucionOtra: '',
        motivo: 'Atención psicológica',
      }),
    ).toMatch(/área interna/i);

    expect(
      validateDerivacion({
        fichaId: 'ficha-1',
        areaOrigenId: 1,
        destino: 'psicologia',
        areaDestinoId: 2,
        institucionId: 5,
        institucionOtra: '',
        motivo: 'Atención psicológica',
      }),
    ).toMatch(/no debe incluir institución externa/i);

    expect(
      validateDerivacion({
        fichaId: 'ficha-1',
        areaOrigenId: 1,
        destino: 'psicologia',
        areaDestinoId: 2,
        institucionId: null,
        institucionOtra: '',
        motivo: 'Atención psicológica',
      }),
    ).toBeNull();
  });

  it('exige exclusión mutua entre institucionId e institucionOtra en externas', () => {
    expect(
      validateDerivacion({
        fichaId: 'ficha-1',
        areaOrigenId: 1,
        destino: 'otra_institucion',
        areaDestinoId: null,
        institucionId: 3,
        institucionOtra: 'DIF Ahome',
        motivo: 'Apoyo asistencial',
      }),
    ).toMatch(/no ambas/i);

    expect(
      validateDerivacion({
        fichaId: 'ficha-1',
        areaOrigenId: 1,
        destino: 'otra_institucion',
        areaDestinoId: null,
        institucionId: null,
        institucionOtra: '',
        motivo: 'Apoyo asistencial',
      }),
    ).toMatch(/institución externa/i);

    expect(
      validateDerivacion({
        fichaId: 'ficha-1',
        areaOrigenId: 1,
        destino: 'fiscalia',
        areaDestinoId: null,
        institucionId: 4,
        institucionOtra: '',
        motivo: 'Acompañamiento para denuncia',
      }),
    ).toBeNull();
  });
});
