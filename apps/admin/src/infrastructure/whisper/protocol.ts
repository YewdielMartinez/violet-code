export interface ArchivoWhisper {
  nombre: string;
  fase: 'conectando' | 'descargando' | 'listo';
  recibidos: number;
  total: number | null;
}

export type WhisperMensaje =
  | { tipo: 'cargando-modelo'; archivos: ArchivoWhisper[] }
  | { tipo: 'transcribiendo' }
  | { tipo: 'resultado'; texto: string }
  | { tipo: 'error' };

export type WhisperEstado = Extract<WhisperMensaje, { tipo: 'cargando-modelo' | 'transcribiendo' }>;
