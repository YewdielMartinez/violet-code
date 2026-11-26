import { supabase } from '../client';
import {
  construirRutaStorage,
  validarArchivo,
  type DocumentoAdjunto,
  type OrdenProteccionOpcion,
  type SubirDocumentoInput,
  type TipoDocumento,
} from '@/domain/models/DocumentoAdjunto';
import type {
  DocumentoStorageRepository,
  UrlFirmadaOpciones,
} from '@/domain/ports/DocumentoStorageRepository';
import {
  mapDocumentoRow,
  mapOrdenProteccionOpcion,
  mapTipoDocumentoRow,
  traducirErrorDocumento,
} from './documento.mapper';

const DOCUMENTOS_BUCKET = 'documentos';
const DEFAULT_SIGNED_URL_SECONDS = 60;

const DOCUMENTO_SELECT =
  'id, ficha_id, tipo_documento_id, orden_proteccion_id, descripcion, ruta_storage, nombre_archivo, activo, creado_en, cat_tipo_documento(id, clave, nombre)';

export const supabaseDocumentoStorageRepository: DocumentoStorageRepository = {
  async listarPorFicha(fichaId: string): Promise<DocumentoAdjunto[]> {
    const { data, error } = await supabase
      .from('documento')
      .select(DOCUMENTO_SELECT)
      .eq('ficha_id', fichaId)
      .eq('activo', true)
      .order('creado_en', { ascending: false });

    if (error) {
      throw traducirErrorDocumento(error, 'No se pudieron cargar los documentos del expediente.');
    }

    return (data ?? []).map(mapDocumentoRow);
  },

  async listarTipos(): Promise<TipoDocumento[]> {
    const { data, error } = await supabase
      .from('cat_tipo_documento')
      .select('id, clave, nombre')
      .order('id', { ascending: true });

    if (error) {
      throw traducirErrorDocumento(error, 'No se pudo cargar el catálogo de tipos de documento.');
    }

    return (data ?? []).map(mapTipoDocumentoRow);
  },

  async listarOrdenesProteccion(fichaId: string): Promise<OrdenProteccionOpcion[]> {
    const { data, error } = await supabase
      .from('orden_proteccion')
      .select('id, numero_oficio, estado, fecha_emision, autoridad_emisora')
      .eq('ficha_id', fichaId)
      .eq('activo', true)
      .order('fecha_emision', { ascending: false });

    if (error) {
      throw traducirErrorDocumento(error, 'No se pudieron cargar las órdenes de protección.');
    }

    return (data ?? []).map(mapOrdenProteccionOpcion);
  },

  async subir(
    input: SubirDocumentoInput,
    onProgress?: (porcentaje: number) => void,
  ): Promise<DocumentoAdjunto> {
    const archivoError = validarArchivo(input.file);
    if (archivoError) {
      throw new Error(archivoError);
    }

    const uuid = crypto.randomUUID();
    const rutaStorage = construirRutaStorage(input.fichaId, input.file.name, uuid);

    onProgress?.(15);

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTOS_BUCKET)
      .upload(rutaStorage, input.file, {
        contentType: input.file.type,
        upsert: false,
      });

    if (uploadError) {
      throw traducirErrorDocumento(uploadError, 'No se pudo subir el archivo al almacenamiento privado.');
    }

    onProgress?.(70);

    const descripcionLimpia = input.descripcion?.trim() || null;

    const { data, error: insertError } = await supabase
      .from('documento')
      .insert({
        ficha_id: input.fichaId,
        tipo_documento_id: input.tipoDocumentoId,
        orden_proteccion_id: input.ordenProteccionId || null,
        descripcion: descripcionLimpia,
        ruta_storage: rutaStorage,
        nombre_archivo: input.file.name,
      })
      .select(DOCUMENTO_SELECT)
      .single();

    if (insertError) {
      try {
        await supabase.storage.from(DOCUMENTOS_BUCKET).remove([rutaStorage]);
      } catch {
        // Limpieza best-effort: no ocultar el error original si Storage rechaza el borrado.
      }
      throw traducirErrorDocumento(insertError, 'No se pudo registrar el documento en el expediente.');
    }

    onProgress?.(100);
    return mapDocumentoRow(data);
  },

  async obtenerUrlFirmada(
    rutaStorage: string,
    segundos = DEFAULT_SIGNED_URL_SECONDS,
    opciones?: UrlFirmadaOpciones,
  ): Promise<string> {
    const storageOptions =
      opciones?.download !== undefined ? { download: opciones.download } : undefined;

    const { data, error } = await supabase.storage
      .from(DOCUMENTOS_BUCKET)
      .createSignedUrl(rutaStorage, segundos, storageOptions);

    if (error || !data?.signedUrl) {
      throw traducirErrorDocumento(error, 'No se pudo generar el enlace temporal del documento.');
    }

    return data.signedUrl;
  },

  async archivar(id: string): Promise<void> {
    const { error } = await supabase
      .from('documento')
      .update({ activo: false })
      .eq('id', id)
      .eq('activo', true);

    if (error) {
      throw traducirErrorDocumento(error, 'No se pudo archivar el documento.');
    }
  },
};
