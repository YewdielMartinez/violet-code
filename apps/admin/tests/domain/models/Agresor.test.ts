import { describe, expect, it } from "vitest";
import type { StaffRole } from "@/domain/models/Auth";
import {
  formatAgresorNombre,
  puedeAccederAgresor,
  validarAgresor,
  type AgresorInput,
  type TipoDroga,
} from "@/domain/models/Agresor";

function baseInput(overrides: Partial<AgresorInput> = {}): AgresorInput {
  return {
    fichaId: "55555555-5555-4555-8555-555555555501",
    nombres: "Roberto",
    apellidoPaterno: "Salazar",
    apellidoMaterno: "Pineda",
    ...overrides,
  };
}

describe("Agresor — permisos y formato", () => {
  it("permite acceso únicamente a Dirección y áreas de atención", () => {
    const allowed: StaffRole[] = [
      "titular",
      "subdireccion",
      "trabajo_social",
      "psicologia",
      "juridico",
    ];
    const denied: (StaffRole | undefined)[] = ["recepcion", "umeca", undefined];

    for (const role of allowed) {
      expect(puedeAccederAgresor(role)).toBe(true);
    }
    for (const role of denied) {
      expect(puedeAccederAgresor(role)).toBe(false);
    }
  });

  it("formatea el nombre completo omitiendo apellidos vacíos o nulos", () => {
    expect(
      formatAgresorNombre({
        nombres: "Roberto",
        apellidoPaterno: "Salazar",
        apellidoMaterno: null,
      }),
    ).toBe("Roberto Salazar");
    expect(
      formatAgresorNombre({
        nombres: "Roberto",
        apellidoPaterno: null,
        apellidoMaterno: null,
      }),
    ).toBe("Roberto");
  });
});

describe("Agresor — validarAgresor", () => {
  it("acepta un registro mínimo válido solo con nombre", () => {
    const result = validarAgresor({
      fichaId: "ficha-1",
      nombres: "Persona Demo",
    });
    expect(result.valido).toBe(true);
    expect(result.errores).toEqual({});
  });

  it("rechaza nombres vacíos o mayores a 100 caracteres", () => {
    expect(
      validarAgresor(baseInput({ nombres: "   " })).errores.nombres,
    ).toBeTruthy();
    expect(
      validarAgresor(baseInput({ nombres: "A".repeat(101) })).errores.nombres,
    ).toBeTruthy();
    expect(validarAgresor(baseInput({ nombres: "A".repeat(100) })).valido).toBe(
      true,
    );
  });

  it("valida código postal de 5 dígitos y exclusión mutua con asentamientoId", () => {
    expect(validarAgresor(baseInput({ codigoPostal: "81200" })).valido).toBe(
      true,
    );
    expect(
      validarAgresor(baseInput({ asentamientoId: 10, codigoPostal: null }))
        .valido,
    ).toBe(true);

    expect(
      validarAgresor(baseInput({ codigoPostal: "8120" })).errores.codigoPostal,
    ).toBeTruthy();
    expect(
      validarAgresor(baseInput({ codigoPostal: "8120A" })).errores.codigoPostal,
    ).toBeTruthy();
    expect(
      validarAgresor(baseInput({ asentamientoId: 10, codigoPostal: "81200" }))
        .errores.codigoPostal,
    ).toBeTruthy();
  });

  it("el consumo de drogas es opcional y admite selección múltiple", () => {
    expect(validarAgresor(baseInput()).valido).toBe(true);
    expect(validarAgresor(baseInput({ drogas: [] })).valido).toBe(true);
    expect(validarAgresor(baseInput({ drogas: null })).valido).toBe(true);
    expect(
      validarAgresor(
        baseInput({
          drogas: ["marihuana", "cristal", "otra"],
          especificacionDroga: "Consumo eventual",
        }),
      ).valido,
    ).toBe(true);
    expect(validarAgresor(baseInput({ drogas: ["no_consume"] })).valido).toBe(true);
  });

  it("rechaza drogas inválidas, «no_consume» combinado y especificaciones demasiado largas", () => {
    const invalidItem = validarAgresor(baseInput({ drogas: ["desconocida" as TipoDroga] }));
    expect(invalidItem.valido).toBe(false);
    expect(invalidItem.errores.drogas).toBeTruthy();

    const combinado = validarAgresor(baseInput({ drogas: ["no_consume", "cristal"] }));
    expect(combinado.valido).toBe(false);
    expect(combinado.errores.drogas).toBeTruthy();

    const larga = validarAgresor(
      baseInput({ drogas: ["otra"], especificacionDroga: "x".repeat(251) }),
    );
    expect(larga.errores.especificacionDroga).toBeTruthy();
  });

  it("valida longitud máxima de especificacionArma", () => {
    const ok = validarAgresor(
      baseInput({
        especificacionArma: "Objeto punzocortante",
      }),
    );
    expect(ok.valido).toBe(true);

    const over = validarAgresor(
      baseInput({ especificacionArma: "x".repeat(251) }),
    );
    expect(over.valido).toBe(false);
    expect(over.errores.especificacionArma).toBeTruthy();
  });

  it("rechaza observaciones mayores a 5000 caracteres", () => {
    expect(
      validarAgresor(baseInput({ observaciones: "x".repeat(5000) })).valido,
    ).toBe(true);
    const over = validarAgresor(baseInput({ observaciones: "x".repeat(5001) }));
    expect(over.valido).toBe(false);
    expect(over.errores.observaciones).toBeTruthy();
  });
});
