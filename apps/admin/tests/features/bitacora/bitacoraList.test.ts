import { describe, expect, it } from 'vitest';
import {
  FILTROS_INICIALES,
  construirFiltrosServidor,
  fechaHoraBitacora,
  hayFiltrosActivos,
  rangoInvalido,
  totalPaginas,
} from '@/features/bitacora/bitacoraList';
import { accionBitacoraLabel, puedeVerBitacora, tablaBitacoraLabel } from '@/domain/models/Bitacora';
import { BITACORA_EXPORT_COLUMNS } from '@/features/bitacora/bitacoraExport';
import { actorRolLabel, toBitacoraRow } from '@/features/bitacora/bitacoraTableConfig';
import { toCsv } from '@/shared/export';

describe('filtros de la bitácora', () => {
  it('sin filtros activos por defecto y sin nada que mandar al servidor', () => {
    expect(hayFiltrosActivos(FILTROS_INICIALES)).toBe(false);
    expect(construirFiltrosServidor(FILTROS_INICIALES)).toEqual({ tabla: null, accion: null, desde: null, hasta: null });
  });

  it('convierte tabla, acción y fechas (día completo, hora local) a filtros del servidor', () => {
    const f = construirFiltrosServidor({ tabla: 'cita', accion: 'crear', desde: '2026-11-01', hasta: '2026-11-30' });
    expect(f?.tabla).toBe('cita');
    expect(f?.accion).toBe('crear');
    expect(f?.desde).toBe(new Date('2026-11-01T00:00:00.000').toISOString());
    expect(f?.hasta).toBe(new Date('2026-11-30T23:59:59.999').toISOString());
  });

  it('un rango con «desde» posterior a «hasta» es inválido y no se consulta', () => {
    const rango = { desde: '2026-12-10', hasta: '2026-11-01' };
    expect(rangoInvalido(rango)).toBe(true);
    expect(construirFiltrosServidor({ ...FILTROS_INICIALES, ...rango })).toBeNull();
    expect(rangoInvalido({ desde: '2026-11-01', hasta: '2026-11-01' })).toBe(false);
  });

  it('calcula el número de páginas (mínimo 1)', () => {
    expect(totalPaginas(0)).toBe(1);
    expect(totalPaginas(25)).toBe(1);
    expect(totalPaginas(26)).toBe(2);
    expect(totalPaginas(100, 10)).toBe(10);
  });

  it('formatea fecha y hora; un valor no válido se devuelve tal cual', () => {
    expect(fechaHoraBitacora('2026-11-27T20:32:05Z')).toMatch(/2026 · \d{2}:\d{2}:\d{2}/);
    expect(fechaHoraBitacora('no-es-fecha')).toBe('no-es-fecha');
  });
});

describe('modelo y filas de la bitácora', () => {
  it('solo titular y subdirección pueden ver la bitácora', () => {
    expect(puedeVerBitacora('titular')).toBe(true);
    expect(puedeVerBitacora('subdireccion')).toBe(true);
    for (const role of ['trabajo_social', 'psicologia', 'juridico', 'recepcion', 'umeca'] as const) {
      expect(puedeVerBitacora(role)).toBe(false);
    }
    expect(puedeVerBitacora(undefined)).toBe(false);
  });

  it('etiqueta acciones y tablas, con respaldo para tablas desconocidas', () => {
    expect(accionBitacoraLabel('ver')).toBe('Consulta');
    expect(tablaBitacoraLabel('ficha_registro')).toBe('Fichas de registro');
    expect(tablaBitacoraLabel('tabla_nueva')).toBe('Tabla nueva');
  });

  it('arma la fila con rol legible y «—» si no hay actor o registro', () => {
    const row = toBitacoraRow({
      id: 'e1',
      creadoEn: '2026-11-27T20:32:05Z',
      actorTipo: 'sistema',
      actorNombre: 'Sistema / App',
      actorRol: null,
      tabla: 'cita',
      accion: 'actualizar',
      registroId: null,
    });
    expect(row).toMatchObject({ id: 'e1', actor: 'Sistema / App', rol: '—', tabla: 'Citas', accion: 'Modificación', registro: '—' });
    expect(actorRolLabel('trabajo_social')).toBe('Trabajo Social');
    expect(actorRolLabel('umeca')).toBe('UMECA (Externo)');
  });

  it('la descarga neutraliza fórmulas y no incluye columnas con datos personales', () => {
    expect(BITACORA_EXPORT_COLUMNS.map((c) => c.key)).toEqual(['fecha', 'actor', 'rol', 'tabla', 'accion', 'registro']);
    const csv = toCsv(
      [
        {
          id: 'e1',
          creadoEn: '2026-11-27T20:32:05Z',
          actorTipo: 'empleado' as const,
          actorNombre: '=HYPERLINK("x")',
          actorRol: 'titular',
          tabla: 'cita',
          accion: 'ver' as const,
          registroId: '+123',
        },
      ],
      BITACORA_EXPORT_COLUMNS,
    );
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
    expect(csv).toContain(",'+123");
  });
});
