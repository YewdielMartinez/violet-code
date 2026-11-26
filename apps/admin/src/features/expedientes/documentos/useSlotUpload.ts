import { useMemo, useRef, useState, type FormEvent } from 'react';
import { toast, type AttachmentProps, type AttachmentUpload } from '@yewdiel21/motion-kit/react';
import {
  validarArchivo,
  validarDocumento,
  type TipoDocumento,
} from '../documentosApi';
import type { ChecklistSlotMeta } from './documentoGrouping';

export interface SlotUploadRequest {
  tipoDocumentoId: number;
  ordenProteccionId: string | null;
  descripcion: string | null;
  file: File;
  onProgress: (porcentaje: number) => void;
}

interface UseSlotUploadParams {
  slot: ChecklistSlotMeta;
  tipos: TipoDocumento[];
  tiposLoading: boolean;
  requiresInlineDetails: boolean;
  onUpload: (req: SlotUploadRequest) => Promise<void>;
}

export function useSlotUpload({
  slot,
  tipos,
  tiposLoading,
  requiresInlineDetails,
  onUpload,
}: UseSlotUploadParams) {
  const attachmentRef: NonNullable<AttachmentProps['instanceRef']> = useRef(null);

  const [staged, setStaged] = useState<{ id: string; file: File } | null>(null);
  const [uploadState, setUploadState] = useState<AttachmentUpload | null>(null);
  const [selectedSubtipoId, setSelectedSubtipoId] = useState('');
  const [ordenProteccionId, setOrdenProteccionId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [slotError, setSlotError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const slotTipo = useMemo(
    () => tipos.find((t) => t.clave === slot.catalogClave) ?? null,
    [tipos, slot.catalogClave],
  );

  const subtiposOtro = useMemo(() => {
    if (slot.key !== 'otro') return [];
    const primary = new Set(['ine', 'foto', 'denuncia', 'orden_proteccion']);
    return tipos
      .filter((t) => !primary.has(t.clave))
      .sort((a, b) => (a.clave === 'otro' ? -1 : b.clave === 'otro' ? 1 : a.id - b.id));
  }, [slot.key, tipos]);

  const effectiveSubtipoId = selectedSubtipoId || (slotTipo ? String(slotTipo.id) : '');

  const activeTipo = useMemo(() => {
    if (slot.key !== 'otro') return slotTipo;
    return tipos.find((t) => String(t.id) === effectiveSubtipoId) ?? slotTipo;
  }, [slot.key, slotTipo, tipos, effectiveSubtipoId]);

  const uploads = useMemo<Record<string, AttachmentUpload> | undefined>(() => {
    if (!staged || !uploadState) return undefined;
    return { [staged.id]: uploadState };
  }, [staged, uploadState]);

  function resetStaged() {
    attachmentRef.current?.clear();
    setStaged(null);
    setUploadState(null);
    setOrdenProteccionId('');
    setDescripcion('');
    setSlotError(null);
    setSubmitState('idle');
    if (slot.key === 'otro' && slotTipo) {
      setSelectedSubtipoId(String(slotTipo.id));
    }
  }

  async function executeUpload(
    fileItem: { id: string; file: File },
    tipoId: number,
    ordenId: string | null,
    desc: string | null,
  ) {
    setSlotError(null);
    setSubmitState('loading');
    setUploadState({ progress: 10, status: 'uploading' });

    try {
      await onUpload({
        tipoDocumentoId: tipoId,
        ordenProteccionId: ordenId,
        descripcion: desc,
        file: fileItem.file,
        onProgress: (progress) => {
          setUploadState({ progress, status: progress >= 100 ? 'complete' : 'uploading' });
        },
      });
      toast(`${slot.title}: documento adjuntado.`, { tone: 'success' });
      resetStaged();
    } catch (err) {
      setUploadState({ progress: 0, status: 'error' });
      setSubmitState('error');
      const msg = err instanceof Error ? err.message : 'No se pudo adjuntar el documento.';
      setSlotError(msg);
      toast(msg, { tone: 'error' });
    }
  }

  function handleFiles(added: Parameters<NonNullable<AttachmentProps['onFiles']>>[0]) {
    const first = added[0];
    if (!first?.file || submitState === 'loading') return;

    const archivoError = validarArchivo(first.file);
    if (archivoError) {
      attachmentRef.current?.remove(first.id);
      setStaged(null);
      setUploadState(null);
      setSlotError(archivoError);
      toast(archivoError, { tone: 'error' });
      return;
    }

    if (tiposLoading || !activeTipo) {
      attachmentRef.current?.remove(first.id);
      const msg = 'Cargando catálogo de tipos de documento. Intenta en un segundo.';
      setSlotError(msg);
      toast(msg, { tone: 'error' });
      return;
    }

    const picked = { id: first.id, file: first.file };
    setStaged(picked);
    setUploadState(null);
    setSlotError(null);
    setSubmitState('idle');

    if (!requiresInlineDetails) {
      void executeUpload(picked, activeTipo.id, null, null);
    }
  }

  function handleReject(rejections: Parameters<NonNullable<AttachmentProps['onReject']>>[0]) {
    const first = rejections[0];
    if (!first) return;
    const msg =
      validarArchivo(first.file) ??
      'El archivo no cumple con el formato permitido (JPG, PNG o PDF, máximo 10 MB).';
    setSlotError(msg);
    toast(msg, { tone: 'error' });
  }

  function handleDetailsSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitState === 'loading' || !staged || !activeTipo) return;

    const validation = validarDocumento({
      tipoDocumentoId: activeTipo.id,
      tipoDocumentoClave: activeTipo.clave,
      descripcion,
      file: staged.file,
    });

    if (validation) {
      setSlotError(validation);
      setSubmitState('error');
      return;
    }

    void executeUpload(staged, activeTipo.id, ordenProteccionId || null, descripcion.trim() || null);
  }

  return {
    attachmentRef,
    staged,
    uploads,
    subtiposOtro,
    effectiveSubtipoId,
    ordenProteccionId,
    descripcion,
    slotError,
    submitState,
    esDescripcionObligatoria: activeTipo?.clave === 'otro',
    isUploading: submitState === 'loading',
    setSelectedSubtipoId: (id: string) => {
      setSelectedSubtipoId(id);
      setSlotError(null);
      setSubmitState('idle');
    },
    setOrdenProteccionId: (id: string) => {
      setOrdenProteccionId(id);
      setSlotError(null);
      setSubmitState('idle');
    },
    setDescripcion: (val: string) => {
      setDescripcion(val);
      setSlotError(null);
      setSubmitState('idle');
    },
    setSubmitState,
    resetStaged,
    handleFiles,
    handleReject,
    handleDetailsSubmit,
  };
}
