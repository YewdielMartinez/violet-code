import { isAttentionRole, isSupervisor, type StaffRole } from './Auth';

export const MIME_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export type MimePermitido = (typeof MIME_PERMITIDOS)[number];

/** Límite del bucket privado `documentos` en Supabase Storage (10 MB). */
export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024;

/** Longitud máxima de `documento.descripcion` en PostgreSQL. */
export const DESCRIPCION_MAX_LENGTH = 500;

/** Longitud máxima de `documento.ruta_storage` en PostgreSQL. */
const RUTA_STORAGE_MAX_LENGTH = 500;

export interface TipoDocumento {
  id: number;
  clave: string;
  nombre: string;
}

export interface OrdenProteccionOpcion {
  id: string;
  label: string;
}

export interface DocumentoAdjunto {
  id: string;
  fichaId: string;
  tipoDocumentoId: number;
  tipoDocumentoClave: string;
  tipoDocumentoNombre: string;
  ordenProteccionId: string | null;
  descripcion: string | null;
  rutaStorage: string;
  nombreArchivo: string;
  activo: boolean;
  creadoEn: string;
}

export interface ArchivoValidable {
  type: string;
  size: number;
  name: string;
}

export interface SubirDocumentoInput {
  fichaId: string;
  tipoDocumentoId: number;
  ordenProteccionId?: string | null;
  descripcion?: string | null;
  file: File;
}

export interface ValidarDocumentoInput {
  tipoDocumentoId?: number | null;
  tipoDocumentoClave?: string | null;
  descripcion?: string | null;
  file?: ArchivoValidable | null;
}

/**
 * Alineado con `tiene_permiso('expediente.ver')` en `07_rls.sql`:
 * Dirección (`titular`, `subdireccion`) y áreas de atención (`trabajo_social`, `psicologia`, `juridico`).
 * `recepcion` y `umeca` NO tienen acceso.
 */
export function puedeVerDocumentos(rol: StaffRole | undefined | null): boolean {
  if (!rol) return false;
  return isSupervisor(rol) || isAttentionRole(rol);
}

/**
 * Indica si un tipo MIME corresponde a una imagen soportada para vista previa.
 */
export function esImagen(mime: string): boolean {
  const normalized = mime.trim().toLowerCase();
  return normalized === 'image/jpeg' || normalized === 'image/png' || normalized.startsWith('image/');
}

/**
 * Infiere el MIME esperado a partir de la extensión del archivo almacenado
 * (la tabla `documento` no persiste una columna MIME separada).
 */
export function inferirMimeDesdeNombre(nombreArchivo: string): string {
  const lower = nombreArchivo.trim().toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return '';
}

/**
 * Valida tipo MIME y tamaño del archivo antes de enviarlo al bucket privado `documentos`.
 * Devuelve un mensaje de error en español o `null` si es válido.
 */
export function validarArchivo(file: ArchivoValidable): string | null {
  if (!file.name.trim()) {
    return 'El archivo debe tener un nombre válido.';
  }

  const mime = file.type.trim().toLowerCase();
  if (!(MIME_PERMITIDOS as readonly string[]).includes(mime)) {
    return 'Tipo de archivo no permitido. Solo se aceptan imágenes JPG, PNG o documentos PDF.';
  }

  if (file.size <= 0) {
    return 'El archivo está vacío. Selecciona un documento válido.';
  }

  if (file.size > TAMANO_MAXIMO_BYTES) {
    return 'El archivo supera el tamaño máximo permitido de 10 MB.';
  }

  return null;
}

/**
 * Sanitiza un nombre de archivo: minúsculas, sin acentos y únicamente `[a-z0-9._-]`.
 */
export function sanitizarNombreArchivo(nombreArchivo: string): string {
  const sinAcentos = nombreArchivo
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

  const limpio = sinAcentos
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-+\./g, '.')
    .replace(/^[.-]+|[.-]+$/g, '');

  return limpio || 'archivo';
}

/**
 * Construye la ruta dentro del bucket privado `documentos`:
 * `${fichaId}/${uuid}-${sanitizedName}` respetando el límite de 500 caracteres.
 */
export function construirRutaStorage(
  fichaId: string,
  nombreArchivo: string,
  uuid: string,
): string {
  const prefix = `${fichaId.trim()}/${uuid.trim()}-`;
  const sanitized = sanitizarNombreArchivo(nombreArchivo);
  const maxNameLength = Math.max(1, RUTA_STORAGE_MAX_LENGTH - prefix.length);

  if (sanitized.length <= maxNameLength) {
    return `${prefix}${sanitized}`;
  }

  const lastDot = sanitized.lastIndexOf('.');
  if (lastDot > 0 && sanitized.length - lastDot <= 10) {
    const ext = sanitized.slice(lastDot);
    const baseMax = Math.max(1, maxNameLength - ext.length);
    return `${prefix}${sanitized.slice(0, baseMax)}${ext}`;
  }

  return `${prefix}${sanitized.slice(0, maxNameLength)}`;
}

/**
 * Valida el formulario de carga de documento adjunto.
 * La descripción es obligatoria cuando la clave del tipo es `'otro'`.
 */
export function validarDocumento(input: ValidarDocumentoInput): string | null {
  if (!input.tipoDocumentoId || input.tipoDocumentoId <= 0) {
    return 'Selecciona un tipo de documento.';
  }

  if (!input.file) {
    return 'Selecciona un archivo para adjuntar.';
  }

  const archivoError = validarArchivo(input.file);
  if (archivoError) return archivoError;

  const descripcion = input.descripcion?.trim() ?? '';
  if (input.tipoDocumentoClave === 'otro' && !descripcion) {
    return 'La descripción es obligatoria cuando el tipo de documento es «Otro».';
  }

  if (descripcion.length > DESCRIPCION_MAX_LENGTH) {
    return `La descripción no puede superar los ${DESCRIPCION_MAX_LENGTH} caracteres.`;
  }

  return null;
}
