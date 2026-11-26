import type { DocumentoAdjunto } from '../documentosApi';

export const SIGNED_URL_TTL_SECONDS = 60;
export const THUMBNAIL_FRESH_MS = 45_000;

export type DocumentoGroupKey = 'ine' | 'foto' | 'denuncia' | 'otros';

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
