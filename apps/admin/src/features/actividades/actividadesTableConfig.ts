import type { DataAction, DataTableProps } from '@yewdiel21/motion-kit/react';
import { esVencida } from '@/domain/models/ActividadEstado';
import {
  ESTADO_ACTIVIDAD_LABELS,
  NIVEL_EDUCATIVO_LABELS,
  TIPO_INSTITUCION_LABELS,
  type ActividadPreventivaItem,
} from '@/domain/models/ActividadPreventiva';
import { createRowDecorator, PILL_SEPARATOR, type RowDecorSpec } from '@/shared/ui/table/tableDecorate';
import { formatNumberCell, numericColumn } from '@/shared/ui/table/tableFormat';
import { fechaCortaActividad, horaActividad, ubicacionActividad } from './actividadesList';

export interface ActividadRow extends Record<string, unknown> {
  id: string;
  /** ISO de la fecha programada: el kit ordena por este valor (la etiqueta es solo texto). */
  programadaEn: string;
  fechaLabel: string;
  titulo: string;
  sede: string;
  ubicacion: string;
  institucion: string;
  tipoActividad: string;
  /** «Pendiente», «Realizada» o «Cancelada» (el chip «Vencida» se añade con `vencida`). */
  estado: string;
  vencida: boolean;
  asistentes: number | null;
}

const VENCIDA_LABEL = 'Vencida';

const ESTADO_OPTIONS = Object.values(ESTADO_ACTIVIDAD_LABELS).map((label) => ({ value: label, label }));

// Configuraciones estáticas fuera del componente para preservar referencias en motion-kit.
export const COLUMNS: DataTableProps<ActividadRow>['columns'] = [
  {
    key: 'programadaEn',
    label: 'Fecha',
    type: 'date',
    sortable: true,
    format: (_value, row) => row.fechaLabel,
  },
  { key: 'titulo', label: 'Título', sortable: true, searchable: true },
  { key: 'sede', label: 'Sede', sortable: true, searchable: true },
  { key: 'ubicacion', label: 'Ubicación', sortable: true, searchable: true },
  { key: 'institucion', label: 'Institución', sortable: true },
  { key: 'tipoActividad', label: 'Tipo de actividad', sortable: true },
  {
    key: 'estado',
    label: 'Estado',
    type: 'select',
    filterable: true,
    options: ESTADO_OPTIONS,
    format: (value, row) => (row.vencida ? `${String(value)}${PILL_SEPARATOR}${VENCIDA_LABEL}` : String(value)),
  },
  numericColumn('asistentes', 'Asistentes', { format: (value) => formatNumberCell(value) }),
];

export const ROW_ACTIONS: DataAction[] = [{ id: 'open', label: 'Ver detalle' }];
export const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

/** Fila de la tabla a partir de una actividad (el reloj `ahora` decide si una pendiente está vencida). */
export function toActividadRow(item: ActividadPreventivaItem, ahora: Date): ActividadRow {
  return {
    id: item.id,
    programadaEn: item.programadaEn,
    fechaLabel: `${fechaCortaActividad(item.programadaEn)} · ${horaActividad(item.programadaEn)}`,
    titulo: item.titulo,
    sede: item.sede,
    ubicacion: ubicacionActividad(item) ?? '—',
    institucion:
      TIPO_INSTITUCION_LABELS[item.tipoInstitucion] +
      (item.nivelEducativo ? ` · ${NIVEL_EDUCATIVO_LABELS[item.nivelEducativo]}` : ''),
    tipoActividad: item.tipoActividadNombre,
    estado: ESTADO_ACTIVIDAD_LABELS[item.estado],
    vencida: esVencida(item, ahora),
    asistentes: item.numeroAsistentes,
  };
}

/**
 * Presentación de la tabla: título destacado, textos largos truncados, estado (con «Vencida») e institución como
 * cápsulas y filas enfocables. Con `split`, cada fragmento separado por « · » es una cápsula.
 */
export const ACTIVIDADES_DECOR = {
  pills: {
    estado: {
      split: true,
      tones: {
        [ESTADO_ACTIVIDAD_LABELS.pendiente]: 'info',
        [ESTADO_ACTIVIDAD_LABELS.realizada]: 'success',
        [ESTADO_ACTIVIDAD_LABELS.cancelada]: 'danger',
        [VENCIDA_LABEL]: 'warning',
      },
    },
    institucion: { tones: {} },
  },
  strong: ['titulo'],
  truncate: ['titulo', 'sede', 'ubicacion'],
  interactive: true,
} satisfies RowDecorSpec;

/** Decorador de filas (el mismo que aplica `VcDataTable`; exportado para pruebas). */
export const decorateActividadRows = createRowDecorator(ACTIVIDADES_DECOR);
