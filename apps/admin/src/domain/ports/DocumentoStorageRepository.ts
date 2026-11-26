import type {
  DocumentoAdjunto,
  OrdenProteccionOpcion,
  SubirDocumentoInput,
  TipoDocumento,
} from '../models/DocumentoAdjunto';

export interface UrlFirmadaOpciones {
  /** Si se indica `true` o un nombre de archivo, fuerza la descarga en el navegador. */
  download?: boolean | string;
}

export interface DocumentoStorageRepository {
  /** Lista los documentos activos (`activo = true`) asociados a una ficha. */
  listarPorFicha(fichaId: string): Promise<DocumentoAdjunto[]>;

  /** Obtiene el catálogo `cat_tipo_documento` para clasificar el adjunto. */
  listarTipos(): Promise<TipoDocumento[]>;

  /** Obtiene las órdenes de protección activas de la ficha para vinculación opcional. */
  listarOrdenesProteccion(fichaId: string): Promise<OrdenProteccionOpcion[]>;

  /**
   * Sube el archivo al bucket privado `documentos` y registra sus metadatos en `documento`.
   * Si el registro en BD falla, intenta limpiar el objeto subido y relanza el error.
   */
  subir(
    input: SubirDocumentoInput,
    onProgress?: (porcentaje: number) => void,
  ): Promise<DocumentoAdjunto>;

  /** Genera una URL firmada temporal (por defecto 60 s). Nunca usa URLs públicas. */
  obtenerUrlFirmada(
    rutaStorage: string,
    segundos?: number,
    opciones?: UrlFirmadaOpciones,
  ): Promise<string>;

  /** Archiva un documento marcando `activo = false` (sin borrado físico). */
  archivar(id: string): Promise<void>;
}
