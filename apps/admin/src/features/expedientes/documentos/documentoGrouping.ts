import type { DocumentoAdjunto } from '../documentosApi';

export const SIGNED_URL_TTL_SECONDS = 60;
export const THUMBNAIL_FRESH_MS = 45_000;

export type DocumentoGroupKey = 'ine' | 'foto' | 'denuncia' | 'otros';

export type ChecklistSlotKey = 'ine' | 'foto' | 'denuncia' | 'orden_proteccion' | 'otro';

export interface ChecklistSlotMeta {
  key: ChecklistSlotKey;
  title: string;
  catalogClave: string;
  icon: string;
  hint: string;
}

export const DOCUMENTO_CHECKLIST_SLOTS: readonly ChecklistSlotMeta[] = [
  {
    key: 'ine',
    title: 'INE',
    catalogClave: 'ine',
    icon: 'badge',
    hint: 'Identificación oficial vigente de la usuaria.',
  },
  {
    key: 'foto',
    title: 'Fotografía',
    catalogClave: 'foto',
    icon: 'photo_camera',
    hint: 'Fotografía reciente para identificación en expediente.',
  },
  {
    key: 'denuncia',
    title: 'Denuncia',
    catalogClave: 'denuncia',
    icon: 'gavel',
    hint: 'Copia de denuncia o carpeta de investigación.',
  },
  {
    key: 'orden_proteccion',
    title: 'Copia de orden de protección',
    catalogClave: 'orden_proteccion',
    icon: 'shield',
    hint: 'Oficio o copia vinculable a una orden activa.',
  },
  {
    key: 'otro',
    title: 'Otro',
    catalogClave: 'otro',
    icon: 'folder_open',
    hint: 'Comprobantes, actas, CURP, solicitudes u otros anexos.',
  },
];

export interface DocumentoGroup {
  key: DocumentoGroupKey;
  title: string;
  icon: string;
  items: DocumentoAdjunto[];
}

export interface DocumentoResumen {
  total: number;
  hasIne: boolean;
  hasFoto: boolean;
  hasDenuncia: boolean;
}

export interface ChecklistResumen extends DocumentoResumen {
  hasOrdenProteccion: boolean;
  hasOtro: boolean;
  keyCompleted: number;
  keyTotal: number;
}

const GROUP_META: ReadonlyArray<{ key: DocumentoGroupKey; title: string; icon: string }> = [
  { key: 'ine', title: 'INE', icon: 'badge' },
  { key: 'foto', title: 'Fotografía', icon: 'photo_camera' },
  { key: 'denuncia', title: 'Denuncia', icon: 'gavel' },
  { key: 'otros', title: 'Otros documentos', icon: 'folder_open' },
];

const DATE_TIME_FMT = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Mazatlan',
});

export function getDocumentoGroupKey(clave: string): DocumentoGroupKey {
  if (clave === 'ine' || clave === 'foto' || clave === 'denuncia') {
    return clave;
  }
  return 'otros';
}

export function getChecklistSlotKey(clave: string): ChecklistSlotKey {
  if (
    clave === 'ine' ||
    clave === 'foto' ||
    clave === 'denuncia' ||
    clave === 'orden_proteccion'
  ) {
    return clave;
  }
  return 'otro';
}

export function partitionDocumentosPorSlot(
  documentos: DocumentoAdjunto[],
): Record<ChecklistSlotKey, DocumentoAdjunto[]> {
  const slots: Record<ChecklistSlotKey, DocumentoAdjunto[]> = {
    ine: [],
    foto: [],
    denuncia: [],
    orden_proteccion: [],
    otro: [],
  };

  for (const doc of documentos) {
    slots[getChecklistSlotKey(doc.tipoDocumentoClave)].push(doc);
  }

  return slots;
}

export function groupDocumentosByTipo(documentos: DocumentoAdjunto[]): DocumentoGroup[] {
  const buckets: Record<DocumentoGroupKey, DocumentoAdjunto[]> = {
    ine: [],
    foto: [],
    denuncia: [],
    otros: [],
  };

  for (const doc of documentos) {
    buckets[getDocumentoGroupKey(doc.tipoDocumentoClave)].push(doc);
  }

  return GROUP_META.map((meta) => ({
    ...meta,
    items: buckets[meta.key],
  })).filter((group) => group.items.length > 0);
}

export function summarizeDocumentos(documentos: DocumentoAdjunto[]): DocumentoResumen {
  let hasIne = false;
  let hasFoto = false;
  let hasDenuncia = false;

  for (const doc of documentos) {
    if (doc.tipoDocumentoClave === 'ine') hasIne = true;
    else if (doc.tipoDocumentoClave === 'foto') hasFoto = true;
    else if (doc.tipoDocumentoClave === 'denuncia') hasDenuncia = true;
  }

  return {
    total: documentos.length,
    hasIne,
    hasFoto,
    hasDenuncia,
  };
}

export function summarizeChecklist(documentos: DocumentoAdjunto[]): ChecklistResumen {
  const base = summarizeDocumentos(documentos);
  let hasOrdenProteccion = false;
  let hasOtro = false;

  for (const doc of documentos) {
    const slot = getChecklistSlotKey(doc.tipoDocumentoClave);
    if (slot === 'orden_proteccion') hasOrdenProteccion = true;
    else if (slot === 'otro') hasOtro = true;
  }

  const keyCompleted =
    Number(base.hasIne) +
    Number(base.hasFoto) +
    Number(base.hasDenuncia) +
    Number(hasOrdenProteccion);

  return {
    ...base,
    hasOrdenProteccion,
    hasOtro,
    keyCompleted,
    keyTotal: 4,
  };
}

export function formatFechaDocumento(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME_FMT.format(date);
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
