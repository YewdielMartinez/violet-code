import { useCallback, useEffect, useRef } from 'react';
import { toast } from '@yewdiel21/motion-kit/react';
import { ROLE_LABELS } from '@/domain/models/Auth';
import { useAuth } from '@/shared/auth/useAuth';
import { isPrintRootMounted, mountPrintRoot, precargarLogos, printReport, unmountPrintRoot } from './printReport';
import type { PrintReportOptions } from './types';

/** Tiempo para que el aviso se pinte antes de que el diálogo de impresión bloquee la página. */
const PRINT_DELAY_MS = 150;

export const PRINT_TOAST = 'Se abrió la vista de impresión: elige «Guardar como PDF» como destino.';
export const PRINT_ERROR_TOAST = 'No se pudo preparar la impresión del reporte.';

/** Etiqueta del rol de la sesión («Psicología»), para el encabezado del documento. */
export function useRolEtiqueta(): string | undefined {
  const { user } = useAuth();
  return user?.role ? ROLE_LABELS[user.role] : undefined;
}

/**
 * Avisa con un toast y, tras un instante (para que el aviso se pinte), abre el diálogo de impresión del navegador.
 * `false` si no hay filas que imprimir.
 */
export function imprimirConAviso<T>(options: PrintReportOptions<T>): boolean {
  if (options.rows.length === 0) return false;
  toast(PRINT_TOAST, { tone: 'success' });
  window.setTimeout(() => {
    printReport(options).catch(() => toast(PRINT_ERROR_TOAST, { tone: 'error' }));
  }, PRINT_DELAY_MS);
  return true;
}

/**
 * Impresión / PDF de una pantalla de reportes. `build` arma el documento con lo que hay en pantalla (o `null` si no hay
 * nada que imprimir) y se vuelve a llamar en `beforeprint`, de modo que `Ctrl/Cmd+P` también imprime el reporte con
 * este mismo diseño. Devuelve `imprimir`: avisa con un toast y abre el diálogo del navegador; `false` si no hay filas.
 */
export function usePrintable<T>(build: () => PrintReportOptions<T> | null): () => boolean {
  const rol = useRolEtiqueta();

  const latest = useRef({ build, rol });
  useEffect(() => {
    latest.current = { build, rol };
  });

  const armar = useCallback((): PrintReportOptions<T> | null => {
    const options = latest.current.build();
    if (!options) return null;
    return { ...options, usuarioRol: options.usuarioRol ?? latest.current.rol };
  }, []);

  // Los logotipos del PDF se piden de antemano para que ya estén en caché al imprimir.
  useEffect(() => precargarLogos(), []);

  // Ctrl/Cmd+P o «Imprimir» del navegador: se monta el mismo documento y se retira al terminar.
  useEffect(() => {
    let unmount: (() => void) | null = null;
    const before = () => {
      if (isPrintRootMounted()) return;
      try {
        const options = armar();
        if (options && options.rows.length > 0) unmount = mountPrintRoot(options);
      } catch {
        // Sin documento propio, el navegador imprime la pantalla tal cual.
      }
    };
    const after = () => {
      unmount?.();
      unmount = null;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      after();
    };
  }, [armar]);

  // Al salir de la pantalla no debe quedar un documento de impresión a medias.
  useEffect(() => () => unmountPrintRoot(), []);

  return useCallback(() => {
    let options: PrintReportOptions<T> | null;
    try {
      options = armar();
    } catch {
      toast(PRINT_ERROR_TOAST, { tone: 'error' });
      return false;
    }
    return options ? imprimirConAviso(options) : false;
  }, [armar]);
}
