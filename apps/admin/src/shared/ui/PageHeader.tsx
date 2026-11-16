import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-on-surface md:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-on-surface-variant">{description}</p>}
      </div>
      {actions}
    </header>
  );
}
