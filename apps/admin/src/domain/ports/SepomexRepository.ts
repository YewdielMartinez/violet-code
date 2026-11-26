import type { AsentamientoSepomex } from '../models/Domicilio';
import type { CatalogosFicha } from '../models/FichaRegistro';

export interface SepomexRepository {
  /** Lista asentamientos oficiales de Ahome (451 registros SEPOMEX), filtrables por CP. */
  listAsentamientos(codigoPostal?: string): Promise<AsentamientoSepomex[]>;
  /** Carga los catálogos institucionales requeridos para la Ficha Única. */
  getCatalogosFicha(): Promise<CatalogosFicha>;
}
