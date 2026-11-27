import { useEffect, useMemo, useState } from 'react';
import { Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/select';
import { SIZE_SPECS, type WidgetSize } from './layout';

interface WidgetSizeSelectProps {
  /** Nombre del widget, para el nombre accesible: «Tamaño de Alertas». */
  title: string;
  value: WidgetSize;
  sizes: readonly WidgetSize[];
  /** Posición del widget: escalona el montaje del `Select` entre las celdas. */
  index: number;
  onChange: (size: WidgetSize) => void;
}

const STAGGER_MS = 45;

export function sizeLabel(size: WidgetSize): string {
  return `${SIZE_SPECS[size].label} ${SIZE_SPECS[size].hint}`;
}

/**
 * Selector de tamaño de la celda: el `Select` del kit (el mismo del resto del sistema) en versión compacta.
 * Cada `Select` crea su `<dialog>`, menú y scroll area al montar (MOTION-KIT-ISSUES #22); con ~10 widgets
 * en «Personalizar» eso se nota, así que solo existe mientras dura el modo edición (los controles se desmontan
 * al salir) y se monta escalonado por celda, detrás de una píldora estática del mismo tamaño que muestra el valor.
 * El menú del kit vive en la capa superior (`<dialog>`), por lo que la tarjeta no lo recorta.
 */
export function WidgetSizeSelect({ title, value, sizes, index, onChange }: WidgetSizeSelectProps) {
  const [ready, setReady] = useState(false);
  const options = useMemo(() => sizes.map((s) => ({ value: s, label: sizeLabel(s) })), [sizes]);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), Math.min(index, 12) * STAGGER_MS);
    return () => window.clearTimeout(timer);
  }, [index]);

  return (
    <div className="vc-size-select" data-ready={ready || undefined}>
      {ready ? (
        <Select
          size="sm"
          label={`Tamaño de ${title}`}
          options={options}
          value={value}
          onChange={(next) => onChange(next as WidgetSize)}
        />
      ) : (
        <div className="vc-size-select__pending" aria-hidden>
          <span className="truncate">{sizeLabel(value)}</span>
        </div>
      )}
    </div>
  );
}
