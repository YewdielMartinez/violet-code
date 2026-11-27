/**
 * Temas retirados del selector (Apariencia). Si alguien los tenía guardados en `vc-theme`,
 * se migra su preferencia al tema predeterminado conservando el modo (claro/oscuro/sistema).
 * Sin dependencias para poder usarse también desde vite.config.ts (script de <head>).
 */
export const RETIRED_THEMES: readonly string[] = ['purple', 'neogreen'];
export const FALLBACK_THEME = 'salmverse';

/** Reescribe en localStorage el tema guardado si fue retirado. Devuelve true si migró. */
export function sanitizeStoredTheme(storageKey: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const stored = JSON.parse(raw) as { id?: unknown; mode?: unknown } | null;
    if (!stored || typeof stored.id !== 'string' || !RETIRED_THEMES.includes(stored.id)) return false;
    localStorage.setItem(storageKey, JSON.stringify({ ...stored, id: FALLBACK_THEME }));
    return true;
  } catch {
    return false;
  }
}

/** Misma migración como script inline; debe ir ANTES de `themeHeadScript` para evitar destello. */
export function retiredThemeHeadScript(storageKey: string): string {
  return `(function(){try{var k=${JSON.stringify(storageKey)},s=JSON.parse(localStorage.getItem(k)||'null');if(s&&${JSON.stringify(RETIRED_THEMES)}.indexOf(s.id)>-1){s.id=${JSON.stringify(FALLBACK_THEME)};localStorage.setItem(k,JSON.stringify(s))}}catch(e){}})();`;
}
