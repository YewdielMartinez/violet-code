/** Categorías reales de `public.categoria_institucion` en Supabase. */
export type CategoriaInstitucion =
  | 'emergencia'
  | 'denuncia'
  | 'orientacion_legal'
  | 'atencion_psicologica'
  | 'trabajo_social'
  | 'refugio'
  | 'salud'
  | 'linea_apoyo';

export const CATEGORIA_LABELS: Record<CategoriaInstitucion, string> = {
  emergencia: 'Emergencia',
  denuncia: 'Denuncia',
  orientacion_legal: 'Orientación legal',
  atencion_psicologica: 'Atención psicológica',
  trabajo_social: 'Trabajo social',
  refugio: 'Refugio (ubicación reservada)',
  salud: 'Salud',
  linea_apoyo: 'Línea de apoyo',
};

export interface DirectorioInstitucion {
  id: number;
  nombre: string;
  categoria: CategoriaInstitucion;
  telefono: string;
  horario: string | null;
  es24Horas: boolean;
  /** Siempre `null` cuando `categoria === 'refugio'` por seguridad. */
  direccion: string | null;
  orden: number;
}
