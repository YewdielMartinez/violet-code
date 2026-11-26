import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import * as mk from '@yewdiel21/motion-kit/react';
import type {
  DialogContentProps,
  FlipGroupProps,
  GlassSwitchProps,
  RadioGroupProps,
  SurfaceRootProps,
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

interface FallbackDialogCtx {
  open: boolean;
  setOpen: (next: boolean) => void;
}

const FallbackDialogContext = createContext<FallbackDialogCtx | null>(null);

function FallbackRoot({ open: controlled, defaultOpen = false, onOpenChange, children }: SurfaceRootProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = controlled ?? uncontrolled;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlled === undefined) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );
  return <FallbackDialogContext.Provider value={{ open, setOpen }}>{children}</FallbackDialogContext.Provider>;
}

function FallbackTrigger({ onClick, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = useContext(FallbackDialogContext);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={ctx?.open ?? false}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) ctx?.setOpen(!(ctx?.open ?? false));
      }}
    >
      {children}
    </button>
  );
}

function FallbackContent({ size: _size, unstyled: _unstyled, className, children, id }: DialogContentProps) {
  const ctx = useContext(FallbackDialogContext);
  return (
    <>
      {ctx?.open ? (
        <div role="dialog" aria-modal="true" id={id} className={className}>
          {children}
        </div>
      ) : null}
    </>
  );
}

const makePart = (Tag: 'header' | 'footer' | 'h2' | 'p' | 'div') =>
  function FallbackPart({ children, ...props }: HTMLAttributes<HTMLElement>) {
    return <Tag {...props}>{children}</Tag>;
  };

function FallbackClose({ children, label = 'Cerrar', onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }) {
  const ctx = useContext(FallbackDialogContext);
  return (
    <button
      type="button"
      aria-label={children ? undefined : label}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) ctx?.setOpen(false);
      }}
    >
      {children ?? label}
    </button>
  );
}

function FallbackHandle({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

export const AgresorDialog: typeof mk.Dialog = mk.Dialog ?? {
  Root: FallbackRoot,
  Trigger: FallbackTrigger,
  Content: FallbackContent,
  Header: makePart('header'),
  Title: makePart('h2'),
  Description: makePart('p'),
  Actions: makePart('div'),
  Body: makePart('div'),
  Footer: makePart('footer'),
  Close: FallbackClose,
  Handle: FallbackHandle,
};

export function AgresorFlipGroup(props: FlipGroupProps) {
  const RealFlipGroup = mk.FlipGroup;
  return RealFlipGroup ? <RealFlipGroup {...props} /> : <>{props.children}</>;
}

export function AgresorRadioGroup(props: RadioGroupProps) {
  const autoId = useId();
  const RealRadioGroup = mk.RadioGroup;
  if (RealRadioGroup) return <RealRadioGroup {...props} />;
  return (
    <div role="radiogroup" aria-label={props.label} className={props.className}>
      {(props.items ?? []).map((item) => (
        <label key={item.value} className="mr-2 inline-flex cursor-pointer items-center gap-1.5 text-sm">
          <input
            type="radio"
            name={props.name ?? autoId}
            value={item.value}
            checked={(props.value ?? null) === item.value}
            disabled={Boolean(props.disabled || item.disabled)}
            onChange={() => props.onChange?.(item.value)}
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
}

export function AgresorGlassSwitch({ children, ...props }: GlassSwitchProps & { children?: ReactNode }) {
  const RealGlassSwitch = mk.GlassSwitch;
  if (RealGlassSwitch) return <RealGlassSwitch {...props}>{children}</RealGlassSwitch>;
  return (
    <label className={props.className}>
      <input
        type="checkbox"
        role="switch"
        aria-label={props.label}
        checked={Boolean(props.checked)}
        disabled={props.disabled}
        onChange={(e) => props.onChange?.(e.target.checked)}
      />
      {children}
    </label>
  );
}

type UseCascadeFn = typeof mk.useCascade;

function useNoopCascade(
  _ref: Parameters<UseCascadeFn>[0],
  _options?: Parameters<UseCascadeFn>[1],
  _deps?: Parameters<UseCascadeFn>[2],
): ReturnType<UseCascadeFn> {
  return useRef<ReturnType<UseCascadeFn>['current']>(null);
}

export const useAgresorCascade: UseCascadeFn =
  typeof mk.useCascade === 'function' ? mk.useCascade : useNoopCascade;
