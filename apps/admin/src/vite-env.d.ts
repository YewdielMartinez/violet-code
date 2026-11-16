/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de Violet Code Core. Vacío en desarrollo (usa el proxy de Vite). */
  readonly VITE_API_URL?: string;
}
