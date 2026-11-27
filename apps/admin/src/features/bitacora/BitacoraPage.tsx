import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DataTable, EmptyState, Pagination, Skeleton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { puedeVerBitacora } from '@/domain/models/Bitacora';
import { useAuth } from '@/shared/auth/useAuth';
import { PageHeader } from '@/shared/ui/PageHeader';
import { SmallEmptyState } from '@/shared/ui/SmallEmptyState';
import { obtenerBitacoraParaExportar, useBitacora, useBitacoraOpciones } from './api';
import { BitacoraToolbar } from './BitacoraToolbar';
import { descargarBitacora, type BitacoraExportFormato } from './bitacoraExport';
import {
  FILTROS_INICIALES,
  construirFiltrosServidor,
  hayFiltrosActivos,
  rangoInvalido,
  totalPaginas,
  type BitacoraListFilters,
} from './bitacoraList';
import { COLUMNS, RETRY_ACTION, decorateBitacoraRows, toBitacoraRow, type BitacoraRow } from './bitacoraTableConfig';
import './bitacora.css';

interface TableSectionProps {
  isLoading: boolean;
  rows: BitacoraRow[];
}

/** Aísla la tabla para que cambiar de página o de filtros no re-renderice `DataTable` sin necesidad. */
const BitacoraTableSection = memo(function BitacoraTableSection({ isLoading, rows }: TableSectionProps) {
  return (
    <Skeleton loading={isLoading} shape="card" lines={6} label="Cargando bitácora">
      <DataTable<BitacoraRow>
        className="vc-expediente-table vc-bitacora-table"
        caption="Bitácora de accesos y cambios"
        rows={rows}
        columns={COLUMNS}
        onRender={decorateBitacoraRows}
        pageSize={0}
        search={false}
        filters={false}
        columnsMenu={false}
      />
    </Skeleton>
  );
});

/**
 * Bitácora de accesos (`RF-22`, `RF-22.1`): quién vio o cambió qué y cuándo. Solo lectura y exclusiva de Dirección
 * (`bitacora.ver`: titular y subdirección). Mismo esquema que Expedientes, Usuarios y Actividades: filtros en la barra
 * de la pantalla (tabla, acción y fechas, resueltos en el servidor) y una tabla paginada del kit. No muestra contenido
 * de notas ni datos personales: la bitácora solo guarda actor, acción, tabla e id del registro.
 */
export default function BitacoraPage() {
  const { user } = useAuth();
  const puedeVer = puedeVerBitacora(user?.role);

  const [filtros, setFiltros] = useState<BitacoraListFilters>(FILTROS_INICIALES);
  const [pagina, setPagina] = useState(1);
  const [descargando, setDescargando] = useState(false);

  const cambiarFiltros = useCallback((patch: Partial<BitacoraListFilters>) => {
    setFiltros((prev) => ({ ...prev, ...patch }));
    setPagina(1);
  }, []);

  const filtrosServidor = useMemo(() => construirFiltrosServidor(filtros), [filtros]);
  const sinRango = filtrosServidor === null;
  const query = useBitacora(filtrosServidor, pagina, puedeVer);
  const opciones = useBitacoraOpciones(puedeVer);

  const total = query.data?.total ?? 0;
  const paginas = totalPaginas(total);
  const rows = useMemo(() => (sinRango ? [] : (query.data?.eventos ?? []).map(toBitacoraRow)), [sinRango, query.data]);
  const loading = !sinRango && query.isPending;
  const isError = !sinRango && query.isError;

  // Si los eventos de la página actual desaparecen (p. ej. se acotó el rango), se vuelve a la primera.
  useEffect(() => {
    if (!sinRango && query.isSuccess && !query.isPlaceholderData && pagina > 1 && rows.length === 0) setPagina(1);
  }, [sinRango, query.isSuccess, query.isPlaceholderData, pagina, rows.length]);

  const handleDescargar = useCallback(
    async (formato: BitacoraExportFormato) => {
      if (!filtrosServidor || descargando) return;
      setDescargando(true);
      try {
        const { eventos, total: totalExportable, truncado } = await obtenerBitacoraParaExportar(filtrosServidor);
        if (eventos.length === 0) {
          toast('No hay eventos que descargar con estos filtros.');
          return;
        }
        descargarBitacora(eventos, formato);
        toast(
          truncado
            ? `Se descargaron los ${eventos.length} eventos más recientes de ${totalExportable}. Acota con las fechas para ver el resto.`
            : `Se descargaron ${eventos.length} eventos.`,
        );
      } catch {
        toast('No se pudo preparar la descarga. Inténtalo de nuevo.', { tone: 'error' });
      } finally {
        setDescargando(false);
      }
    },
    [filtrosServidor, descargando],
  );

  if (user && !puedeVer) {
    return <Navigate to="/" replace />;
  }

  const hayFiltros = hayFiltrosActivos(filtros);
  let vacio = {
    icon: 'history',
    title: 'Aún no hay eventos en la bitácora',
    description: 'Aquí aparecerá quién consulta o modifica información en el sistema.',
  };
  if (rangoInvalido(filtros)) {
    vacio = {
      icon: 'event',
      title: 'Rango de fechas no válido',
      description: 'La fecha «desde» es posterior a «hasta». Ajusta el rango en «Fechas».',
    };
  } else if (hayFiltros) {
    vacio = {
      icon: 'filter_alt_off',
      title: 'Sin eventos con estos filtros',
      description: 'Prueba con otra tabla, otra acción o un rango de fechas distinto.',
    };
  }

  return (
    <>
      <PageHeader
        title="Bitácora"
        actions={
          <BitacoraToolbar
            filtros={filtros}
            opciones={opciones.data}
            onChange={cambiarFiltros}
            onDescargar={(formato) => void handleDescargar(formato)}
            descargando={descargando}
            sinDatos={sinRango || (query.isSuccess && total === 0)}
          />
        }
      />

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudo cargar la bitácora"
            description="Verifica tu conexión e inténtalo de nuevo."
            actions={RETRY_ACTION}
            onAction={() => void query.refetch()}
          />
        </div>
      ) : loading ? (
        <BitacoraTableSection isLoading rows={[]} />
      ) : rows.length === 0 ? (
        <SmallEmptyState
          icon={vacio.icon}
          title={vacio.title}
          description={vacio.description}
          action={hayFiltros ? { label: 'Limpiar filtros', onClick: () => cambiarFiltros({ ...FILTROS_INICIALES }) } : undefined}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-on-surface-variant" role="status">
            {total === 1 ? '1 evento' : `${total.toLocaleString('es-MX')} eventos`}
            {paginas > 1 ? ` · página ${pagina} de ${paginas}` : ''}
          </p>
          <BitacoraTableSection isLoading={false} rows={rows} />
          {paginas > 1 ? (
            <nav className="vc-bitacora-pager" aria-label="Paginación de la bitácora">
              <Pagination
                totalPages={paginas}
                page={Math.min(pagina, paginas)}
                onChange={setPagina}
                pageLabel={(n) => `Página ${n}`}
                previousLabel="Página anterior"
                nextLabel="Página siguiente"
              />
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
