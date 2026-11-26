import type { ReactNode } from 'react';
// Imports con nombre: `import * as` y el acceso dinámico a exports impedían el tree-shaking
// de motion-kit (todo el kit terminaba en el chunk de entrada).
import {
  Dialog,
  FlipGroup,
  GlassSwitch,
  RadioGroup,
  useCascade,
  type FlipGroupProps,
  type GlassSwitchProps,
  type RadioGroupProps,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/radio-group';
import '@yewdiel21/motion-kit/css/components/glass-switch';

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Diálogo del formulario de persona agresora: crece desde el botón que lo abre. */
export const AgresorDialog = Dialog;

export function AgresorFlipGroup(props: FlipGroupProps) {
  return <FlipGroup {...props} />;
}

export function AgresorRadioGroup(props: RadioGroupProps) {
  return <RadioGroup {...props} />;
}

export function AgresorGlassSwitch({ children, ...props }: GlassSwitchProps & { children?: ReactNode }) {
  return <GlassSwitch {...props}>{children}</GlassSwitch>;
}

export const useAgresorCascade = useCascade;
