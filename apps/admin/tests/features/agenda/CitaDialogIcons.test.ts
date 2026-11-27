import { describe, expect, it } from 'vitest';
import indexHtml from '../../../index.html?raw';

/**
 * `index.html` carga Material Symbols con `icon_names=...` (fuente reducida). Un ícono que no esté en esa lista se
 * ve como texto recortado («N», «P»…) porque la ligadura no existe. Este test evita volver a usar uno ausente en
 * toda la Agenda y en la vista de UMECA.
 */
const FUENTES = import.meta.glob<string>(
  [
    '/src/features/agenda/**/*.{ts,tsx}',
    '/src/features/dashboard/UmecaHomeView.tsx',
    '/src/features/dashboard/umecaAsistencia.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
);

function listasDeIconos(): string[][] {
  const matches = [...indexHtml.matchAll(/icon_names=([a-z0-9_,]+)/g)];
  expect(matches.length, 'index.html debe declarar icon_names').toBeGreaterThan(0);
  return matches.map((m) => m[1].split(','));
}

function iconosUsados(source: string): string[] {
  const nombres = new Set<string>();
  // `<Icon name="x" />`, `icono="x"` / `icon="x"` (props) y `icon: 'x'` (tablas de configuración).
  for (const m of source.matchAll(/(?:<Icon\s+name|icono|icon)="([a-z0-9_]+)"/g)) nombres.add(m[1]);
  for (const m of source.matchAll(/\bicon:\s*'([a-z0-9_]+)'/g)) nombres.add(m[1]);
  // Expresiones: `name={done ? 'check' : 'check_circle'}`.
  for (const m of source.matchAll(/(?:<Icon\s+name|icono|icon)=\{([^}]*)\}/g)) {
    for (const lit of m[1].matchAll(/'([a-z0-9_]+)'/g)) nombres.add(lit[1]);
  }
  return [...nombres];
}

describe('íconos de la Agenda y de UMECA', () => {
  const listas = listasDeIconos();

  it('lee todos los archivos de la Agenda y la vista UMECA', () => {
    const archivos = Object.keys(FUENTES);
    expect(archivos.length).toBeGreaterThanOrEqual(20);
    expect(archivos).toContain('/src/features/agenda/CitaDialog.tsx');
    expect(archivos).toContain('/src/features/agenda/AgendaPage.tsx');
    expect(archivos).toContain('/src/features/agenda/AgendaSidePanels.tsx');
    expect(archivos).toContain('/src/features/dashboard/UmecaHomeView.tsx');
  });

  it('las listas icon_names de index.html están ordenadas alfabéticamente (requisito de Google Fonts)', () => {
    for (const lista of listas) expect(lista).toEqual([...lista].sort());
  });

  it.each(Object.entries(FUENTES))('%s solo usa íconos incluidos en la fuente reducida', (_archivo, source) => {
    for (const lista of listas) {
      const cargados = new Set(lista);
      expect(iconosUsados(source).filter((name) => !cargados.has(name))).toEqual([]);
    }
  });
});
