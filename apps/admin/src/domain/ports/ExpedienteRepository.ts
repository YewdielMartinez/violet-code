import type { ExpedienteResumen } from '../models/Persona';
import type { VerificacionCurpResult } from '../models/PreRegistroMovil';

export interface ExpedienteRepository {
  /** Lista expedientes activos filtrados opcionalmente por CURP exacta, folio o nombre. */
  list(query?: string): Promise<ExpedienteResumen[]>;
  /** Obtiene un expediente activo por su UUID de `ficha_registro`, o `null` si no existe. */
  getById(fichaId: string): Promise<ExpedienteResumen | null>;
  /**
   * Verifica duplicados por CURP en `persona` / `ficha_registro` y, si no existe expediente
   * y el rol tiene permiso, consulta `buscar_pre_registro_por_curp` para precarga móvil.
   */
  verifyByCurp(curp: string, allowPreRegistroLookup: boolean): Promise<VerificacionCurpResult>;
  /** Registra en `bitacora_acceso` la apertura de un expediente (`RF-22`). */
  registerConsult(fichaId: string): Promise<void>;
}
