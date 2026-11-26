import { useEffect, type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** Línea corta bajo el título (fecha, contexto). */
  subtitle?: string;
  /** Texto explicativo opcional, debajo de la barra. */
  description?: string;
  /** Acciones de la pantalla: en la MISMA barra que el título, a la derecha. */
  actions?: ReactNode;
  /** Título de la pestaña del navegador si difiere de `title` (p. ej. saludos con nombre). */
  documentTitle?: string;
}

const APP_NAME = 'Violet Code';

/** Fija `document.title` como «<pantalla> · Violet Code». */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}

/** Barra de la pantalla: título a la izquierda y acciones a la derecha, en una sola fila. */
export function PageHeader({ title, subtitle, description, actions, documentTitle }: PageHeaderProps) {
  useDocumentTitle(documentTitle ?? title);

  return (
    <header className="mb-6">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-medium tracking-tight text-on-surface md:text-3xl">{title}</h1>
          {subtitle ? <p className="text-sm text-on-surface-variant first-letter:uppercase">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {description ? <p className="mt-3 max-w-3xl text-on-surface-variant">{description}</p> : null}
    </header>
  );
}
