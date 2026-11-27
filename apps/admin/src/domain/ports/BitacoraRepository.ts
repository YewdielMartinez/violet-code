import type { BitacoraOpcionesFiltro, BitacoraPagina, BitacoraPaginaInput } from '../models/Bitacora';

export interface BitacoraRepository {
  /** Una página de eventos (más recientes primero) con el total que cumple los filtros (`RF-22.1`). */
  listar(input: BitacoraPaginaInput): Promise<BitacoraPagina>;
  /** Tablas con eventos y acciones disponibles para los filtros. */
  opcionesFiltro(): Promise<BitacoraOpcionesFiltro>;
}
