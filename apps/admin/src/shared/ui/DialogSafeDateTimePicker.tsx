import { useEffect, useRef, type ComponentProps } from 'react';
import { DateTimePicker } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/date-time-picker';
import '@yewdiel21/motion-kit/css/components/range-calendar';
import '@yewdiel21/motion-kit/css/components/time-field';
import '@yewdiel21/motion-kit/css/components/popover';

/** Eventos del kit que un popover anidado emite y que un `Dialog`/drawer padre no debe interpretar como propios. */
const NESTED_EVENTS = ['mk:close', 'mk:closed'] as const;

/**
 * `DateTimePicker` seguro dentro de un `Dialog`/drawer del kit (ver MOTION-KIT-ISSUES.md, punto 26).
 *
 * El popover del selector es un `<dialog>` hijo del DOM del diálogo padre y su botón «Listo» lleva `data-mk-close`.
 * El `Dialog` del kit delega el clic con `target.closest('[data-mk-close]') && dialog.contains(target)`, así que el clic
 * en «Listo» también cerraba el diálogo padre. Este envoltorio (sin caja propia: `display: contents`) detiene en su
 * frontera, con un listener nativo, el clic de cierre y los `mk:close`/`mk:closed` del popover. Va en el DOM entre el
 * popover y el padre, por lo que el propio selector sigue recibiendo sus eventos.
 */
export function DialogSafeDateTimePicker(props: ComponentProps<typeof DateTimePicker>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const onClick = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-mk-close]')) event.stopPropagation();
    };
    const stop = (event: Event) => event.stopPropagation();
    host.addEventListener('click', onClick);
    for (const type of NESTED_EVENTS) host.addEventListener(type, stop);
    return () => {
      host.removeEventListener('click', onClick);
      for (const type of NESTED_EVENTS) host.removeEventListener(type, stop);
    };
  }, []);

  return (
    <div ref={ref} className="contents">
      <DateTimePicker {...props} />
    </div>
  );
}
