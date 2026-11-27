import '@/shared/ui/chart/chart.css';

interface SparklineProps {
  values: readonly number[];
  /** Nombre accesible; los valores se agregan al final («Alertas por día: 1, 3, 2»). */
  label: string;
  className?: string;
}

const W = 120;
const H = 40;
const PAD = 4;

/**
 * Minigráfica de línea (sin ejes, como todo sparkline): base en cero para no exagerar variaciones,
 * color del tema y punto final. Se estira al tamaño del contenedor (`preserveAspectRatio="none"`);
 * el trazo y el punto no se deforman gracias a `vector-effect: non-scaling-stroke`.
 */
export function Sparkline({ values, label, className = '' }: SparklineProps) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = (W - PAD * 2) / (values.length - 1);
  const pts = values.map((v, i) => [PAD + i * step, H - PAD - (v / max) * (H - PAD * 2)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const [lastX, lastY] = pts[pts.length - 1];
  const area = `${line} L${lastX.toFixed(2)} ${H} L${PAD} ${H} Z`;
  return (
    <svg
      role="img"
      aria-label={`${label}: ${values.join(', ')}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`vc-spark text-primary ${className}`}
    >
      <path d={area} fill="currentColor" opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M${lastX.toFixed(2)} ${lastY.toFixed(2)}h0`}
        stroke="currentColor"
        strokeWidth={7}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
