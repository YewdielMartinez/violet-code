import type {
  Agresor,
  AgresorInput,
  AsentamientoOpcion,
  CatalogoOpcion,
} from '../models/Agresor';

export type TablaConsultaAgresor = 'ficha_registro' | 'agresor';

export interface AgresorRepository {
  /** Lista las personas agresoras activas vinculadas a una ficha. */
  listarPorFicha(fichaId: string): Promise<Agresor[]>;
  /** Crea o actualiza una persona agresora vía `guardar_agresor` (`actualizadoEnEsperado` aplica bloqueo optimista). */
  crear(input: AgresorInput): Promise<Agresor>;
  /** Actualiza una persona agresora existente mediante `guardar_agresor`. */
  actualizar(id: string, input: AgresorInput): Promise<Agresor>;
  /** Realiza baja lógica (`activo = false`) de una persona agresora mediante `desactivar_agresor`. */
  desactivar(id: string, motivo?: string | null): Promise<void>;
  /** Registra en `bitacora_acceso` la consulta sensible (`RF-05`, `RF-22`). */
  registrarConsulta(tabla: TablaConsultaAgresor, registroId: string): Promise<void>;
  /** Carga el catálogo de parentescos (`cat_parentesco`). */
  listarParentescos(): Promise<CatalogoOpcion[]>;
  /** Carga el catálogo de ocupaciones (`cat_ocupacion`). */
  listarOcupaciones(): Promise<CatalogoOpcion[]>;
  /** Carga los asentamientos SEPOMEX del municipio de Ahome (`cat_asentamiento`). */
  listarAsentamientosAhome(): Promise<AsentamientoOpcion[]>;
}
