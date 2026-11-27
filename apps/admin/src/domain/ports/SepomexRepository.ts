import type { AsentamientoSepomex } from '../models/Domicilio';
import type { CatalogoItem, CatalogosFicha } from '../models/FichaRegistro';

/** Catálogos institucionales simples (`cat_<nombre>`: id, clave, nombre). */
export type CatalogoNombre = 'area' | 'ocupacion' | 'parentesco';

export interface SepomexRepository {
  /** Lista asentamientos oficiales de Ahome (451 registros SEPOMEX), filtrables por CP. */
  listAsentamientos(codigoPostal?: string): Promise<AsentamientoSepomex[]>;
  /** Carga los catálogos institucionales requeridos para la Ficha Única. */
  getCatalogosFicha(): Promise<CatalogosFicha>;
  /** Carga un catálogo institucional ordenado por nombre (una consulta por catálogo, cacheable aparte). */
  listCatalogo(catalogo: CatalogoNombre): Promise<CatalogoItem[]>;
}
