import type { OrdenProteccion, OrdenProteccionInput } from '../models/OrdenProteccion';

export interface OrdenProteccionRepository {
  /** Lista las órdenes de protección activas asociadas a una ficha. */
  listarPorFicha(fichaId: string): Promise<OrdenProteccion[]>;
  /** Crea una nueva orden de protección en la ficha. */
  crear(input: OrdenProteccionInput): Promise<OrdenProteccion>;
  /** Actualiza una orden existente (con bloqueo optimista si se envía `actualizadoEnEsperado`). */
  actualizar(id: string, input: OrdenProteccionInput): Promise<OrdenProteccion>;
  /** Desactiva una orden (`activo = false`, sin borrado físico). */
  desactivar(id: string, actualizadoEnEsperado?: string): Promise<void>;
}
