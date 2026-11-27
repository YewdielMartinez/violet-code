import { useSyncExternalStore } from 'react';

/**
 * Preferencias de interfaz guardadas en el navegador (no son datos sensibles).
 * El tema y el modo los guarda motion-kit (clave 'vc-theme-v2', ver src/app/theme.ts); aquí, el estilo de navegación.
 */
export type NavStyleId = 'rail' | 'sidebar' | 'pills' | 'card' | 'dock' | 'wash';

export const NAV_STYLES: { id: NavStyleId; label: string }[] = [
  { id: 'rail', label: 'Riel' },
  { id: 'sidebar', label: 'Clásica' },
  { id: 'pills', label: 'Bonita' },
  { id: 'card', label: 'Guapa' },
  { id: 'dock', label: 'Dock' },
  { id: 'wash', label: 'Lavado' },
];

const KEY = 'vc-nav-style';
/**
 * Accesibilidad y usabilidad institucional: en una dependencia pública con rotación
 * de personal y distintos niveles de experiencia digital, mostrar iconos + etiquetas
 * por defecto ('sidebar') evita memorizar 12 iconos aislados y mejora la descubribilidad.
 * Quien prefiera mayor densidad visual puede elegir 'rail', 'dock', etc. en Apariencia.
 */
const DEFAULT: NavStyleId = 'sidebar';
const listeners = new Set<() => void>();

function read(): NavStyleId {
  try {
    const v = localStorage.getItem(KEY);
    return NAV_STYLES.some((s) => s.id === v) ? (v as NavStyleId) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let current = read();

export function setNavStyle(style: NavStyleId) {
  current = style;
  try {
    localStorage.setItem(KEY, style);
  } catch {
    /* almacenamiento bloqueado: se queda solo en memoria */
  }
  listeners.forEach((l) => l());
}

export function useNavStyle() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

/** Temas de motion-kit ofrecidos en Apariencia (cada uno importado en index.css). */
export const THEME_CHOICES = ['purple', 'blue', 'pink', 'red', 'neogreen', 'black', 'oled'];
