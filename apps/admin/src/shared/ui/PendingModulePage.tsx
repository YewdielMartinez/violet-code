import { EmptyState } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { PageHeader } from './PageHeader';

/** Página de un módulo aún no implementado. Reemplazar por la feature real en src/features/<modulo>. */
export default function PendingModulePage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="rounded-3xl bg-surface-container-low p-10">
        <EmptyState
          illustration="folder"
          title="Módulo en construcción"
          description="Se implementa después de validar el proceso con SEMUJERES."
        />
      </div>
    </>
  );
}
