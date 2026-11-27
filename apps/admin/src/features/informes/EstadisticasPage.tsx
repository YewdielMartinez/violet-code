import { useMemo, useState } from 'react';
import type { ReporteTipo } from '@/domain/models/Reporte';
import { PageHeader } from '@/shared/ui/PageHeader';
import { SegmentedTabs, type SegmentedOption } from '@/shared/ui/SegmentedTabs';
import { useAuth } from '@/shared/auth/useAuth';
import { EstadisticasToolbar, type AreaControl } from './EstadisticasToolbar';
import { ResumenSection } from './ResumenSection';
import { useAreas } from './api';
import { areaEfectiva, puedeElegirArea, puedeVerInformes } from './informesPermisos';
import { REPORTES } from './reportes/catalogo';
import {
  etiquetaPeriodo,
  periodoInicial,
  rangoAnterior,
  rangoDePeriodo,
  rangoTendencia,
  rangoValido,
} from './reportes/periodo';
import { ReportesSection } from './reportes/ReportesSection';
import './informes.css';

type Vista = 'resumen' | 'reportes';

const VISTA_OPTIONS: readonly SegmentedOption<Vista>[] = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'reportes', label: 'Reportes' },
];

export interface EstadisticasPageProps {
  /** Fecha de referencia (periodo inicial); por defecto, hoy. Útil en pruebas. */
  now?: Date;
}

/**
 * Estadísticas: analítica en vez de tarjetas. Una barra de filtros común (periodo, año / mes / rango y área) alimenta
 * dos vistas: «Resumen» (KPI con variación y gráficas de atenciones) y «Reportes» (tipo de reporte por área con tabla,
 * gráfica y descarga CSV / Excel). Dirección elige el área; las áreas de atención quedan fijas en la suya. Recepción y
 * UMECA no tienen `informe.ver` (42501): la pantalla no se monta.
 */
export default function EstadisticasPage({ now }: EstadisticasPageProps = {}) {
  const { user } = useAuth();
  const permitido = puedeVerInformes(user?.role);
  const direccion = puedeElegirArea(user?.role);

  const [reference] = useState(() => now ?? new Date());
  const [vista, setVista] = useState<Vista>('resumen');
  const [periodo, setPeriodo] = useState(() => periodoInicial(reference));
  const [areaSeleccion, setAreaSeleccion] = useState<number | null>(null);
  const [tipo, setTipo] = useState<ReporteTipo>('atenciones');

  const areasQuery = useAreas(permitido && direccion);
  const areas = useMemo(() => areasQuery.data ?? [], [areasQuery.data]);

  const rango = useMemo(() => rangoDePeriodo(periodo), [periodo]);
  const anterior = useMemo(() => (rangoValido(rango) ? rangoAnterior(periodo) : rango), [periodo, rango]);
  const tendencia = useMemo(() => (rangoValido(rango) ? rangoTendencia(periodo) : rango), [periodo, rango]);
  const habilitado = permitido && rangoValido(rango);

  const areaId = areaEfectiva(user?.role, user?.areaId, areaSeleccion);
  const areaNombre = direccion
    ? (areas.find((a) => a.id === areaSeleccion)?.nombre ?? null)
    : (user?.areaNombre ?? null);

  const def = REPORTES[tipo];
  const areaControl = useMemo<AreaControl>(
    () =>
      direccion
        ? {
            modo: 'seleccion',
            value: areaSeleccion,
            areas,
            onChange: setAreaSeleccion,
            deshabilitado: vista === 'reportes' && !def.aplicaArea,
          }
        : { modo: 'fija', nombre: user?.areaNombre ?? 'Mi área' },
    [direccion, areaSeleccion, areas, vista, def.aplicaArea, user?.areaNombre],
  );

  if (!permitido) return null;

  const subtitle = `${etiquetaPeriodo(periodo)} · ${areaNombre ?? 'Todas las áreas'}`;

  return (
    <section aria-label="Estadísticas" className="@container est-page">
      <PageHeader
        title="Estadísticas"
        subtitle={subtitle}
        actions={<SegmentedTabs label="Vista de estadísticas" options={VISTA_OPTIONS} value={vista} onChange={setVista} />}
      />
      <EstadisticasToolbar
        periodo={periodo}
        onPeriodo={setPeriodo}
        anioActual={reference.getFullYear()}
        area={areaControl}
      />
      {vista === 'resumen' ? (
        <ResumenSection
          rango={rango}
          rangoAnterior={anterior}
          rangoTendencia={tendencia}
          areaId={areaId}
          mostrarPorArea={direccion && areaSeleccion === null}
          habilitado={habilitado}
          etiquetaPeriodo={etiquetaPeriodo(periodo)}
          areaNombre={areaNombre}
        />
      ) : (
        <ReportesSection
          tipo={tipo}
          onTipo={setTipo}
          periodo={periodo}
          rango={rango}
          areaId={areaId}
          areaNombre={areaNombre}
          habilitado={habilitado}
        />
      )}
    </section>
  );
}
