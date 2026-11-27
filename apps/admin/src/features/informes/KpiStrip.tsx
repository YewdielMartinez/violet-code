import { AnimatedNumber } from '@yewdiel21/motion-kit/react';
import { Icon } from '@/shared/ui/Icon';
import { formatNumber } from './ChartPanel';
import type { Delta } from './reportes/estadisticas';
import './informes.css';

export interface KpiItem {
  id: string;
  label: string;
  /** Número (se anima) o texto ya formateado («72,5 %», «—»). */
  value: number | string;
  /** Variación contra el periodo anterior; sin él no se muestra la línea de cambio. */
  delta?: Delta;
  /** Texto completo para lectores de pantalla. */
  text: string;
}

function deltaTexto(delta: Delta): string | null {
  if (delta.direccion === 'sin_dato') return null;
  if (delta.direccion === 'igual') return 'Igual que el periodo anterior';
  const signo = delta.direccion === 'sube' ? '+' : '−';
  const cuanto = delta.pct === null ? formatNumber(Math.abs(delta.diff)) : `${Math.abs(delta.pct)} %`;
  return `${signo}${cuanto} vs. periodo anterior`;
}

const DELTA_ICON = { sube: 'north_east', baja: 'south_east', igual: 'arrow_right_alt' } as const;

/**
 * Franja compacta de indicadores: cifra, nombre y variación contra el periodo anterior, separados por filetes (no son
 * tarjetas). La variación es neutra (flecha + texto): que suba o baje una atención no es «bueno» ni «malo» por sí solo.
 */
export function KpiStrip({ items, label }: { items: readonly KpiItem[]; label: string }) {
  const tres = items.length === 3;
  return (
    <dl className={`est-kpis ${tres ? 'est-kpis--three' : ''}`} aria-label={label}>
      {items.map((item) => {
        const cambio = item.delta ? deltaTexto(item.delta) : null;
        return (
          <div key={item.id} className="est-kpi" role="group" aria-label={item.text}>
            <dt className="est-kpi__label" aria-hidden>
              {item.label}
            </dt>
            <dd className="est-kpi__value" aria-hidden>
              {typeof item.value === 'number' ? <AnimatedNumber value={item.value} format={formatNumber} /> : item.value}
            </dd>
            {cambio && item.delta && item.delta.direccion !== 'sin_dato' ? (
              <p className="est-kpi__delta" aria-hidden>
                <Icon name={DELTA_ICON[item.delta.direccion]} className="text-[16px]" />
                <span>{cambio}</span>
              </p>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}
