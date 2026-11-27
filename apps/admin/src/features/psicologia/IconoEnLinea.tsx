import { Icon } from '@/shared/ui/Icon';

/**
 * Ícono para filas de aviso (ícono + texto). Ocupa exactamente una línea de texto (`1lh`) y centra el glifo en ella,
 * así queda alineado con la primera línea aunque el mensaje se parta en varias.
 */
export function IconoEnLinea({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`flex h-[1lh] shrink-0 items-center ${className}`}>
      <Icon name={name} className="text-[1.25rem]" />
    </span>
  );
}
