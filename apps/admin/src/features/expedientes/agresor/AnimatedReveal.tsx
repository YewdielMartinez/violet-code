import type { ReactNode } from 'react';

interface AnimatedRevealProps {
  show: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Contenedor animado con colapso de altura (`grid-rows`) y respeto a `prefers-reduced-motion`
 * para mostrar u ocultar campos condicionales sin desmontarlos abruptamente.
 */
export function AnimatedReveal({ show, className = '', children }: AnimatedRevealProps) {
  return (
    <div
      aria-hidden={!show}
      inert={show ? undefined : true}
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
        show ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      } ${className}`}
    >
      <div className="overflow-hidden">
        <div
          className={`transition-transform duration-200 ease-out motion-reduce:transition-none ${
            show ? 'translate-y-0' : '-translate-y-1.5'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
