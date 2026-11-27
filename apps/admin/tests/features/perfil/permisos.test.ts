import { describe, expect, it } from 'vitest';
import { agruparPermisos, etiquetaPermiso } from '@/features/perfil/permisos';

describe('agruparPermisos', () => {
  it('agrupa por prefijo y ordena los grupos', () => {
    const grupos = agruparPermisos(['agenda.ver', 'expediente.ver', 'agenda.crear', 'nota_psicologia.acceder']);
    expect(grupos.map((g) => g.titulo)).toEqual(['Expedientes', 'Notas de psicología', 'Agenda']);
    expect(grupos[2].permisos.map((p) => p.clave)).toEqual(['agenda.ver', 'agenda.crear']);
  });

  it('une derivacion.* y canalizacion.* bajo «Canalizaciones» sin perder claves', () => {
    const grupos = agruparPermisos(['derivacion.gestionar', 'canalizacion.crear']);
    expect(grupos.every((g) => g.titulo === 'Canalizaciones')).toBe(true);
    expect(grupos.flatMap((g) => g.permisos)).toHaveLength(2);
  });

  it('da una etiqueta legible a claves desconocidas', () => {
    expect(etiquetaPermiso('reporte.exportar_todo')).toBe('Exportar todo');
  });

  it('devuelve lista vacía sin permisos', () => {
    expect(agruparPermisos([])).toEqual([]);
  });
});
