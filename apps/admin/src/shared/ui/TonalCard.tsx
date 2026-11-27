import type { ReactNode } from 'react';
import { Icon } from './Icon';
import './vc-ui.css';

/** Rejilla de 2 columnas (1 en diálogos angostos) para las tarjetas tonales del detalle. */
export function TonalCardGrid({ children }: { children: ReactNode }) {
  return <div className="vc-card-grid">{children}</div>;
}

export interface TonalCardProps {
  title: string;
  /** Ocupa todo el ancho de la rejilla. */
  wide?: boolean;
  children: ReactNode;
}

/** Tarjeta tonal del detalle: etiqueta en mayúsculas chicas + contenido. */
export function TonalCard({ title, wide = false, children }: TonalCardProps) {
  return (
    <section className={`vc-tonal-card ${wide ? 'vc-tonal-card--wide' : ''}`}>
      <h3 className="vc-card-label">{title}</h3>
      {children}
    </section>
  );
}

/** Lista de datos (`dl`) dentro de una tarjeta. */
export function CardDatos({ children }: { children: ReactNode }) {
  return <dl className="vc-datos">{children}</dl>;
}

/** Dato de texto: etiqueta chica y apagada arriba, valor debajo. */
export function CardDato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="vc-dato">
      <dt className="vc-sublabel">{label}</dt>
      <dd className="vc-value">{children}</dd>
    </div>
  );
}

/** Dato dentro de una caja tipo campo (ícono + valor), como los campos de fecha y hora de los formularios. */
export function CardFieldDato({ label, icon, children }: { label: string; icon: string; children: ReactNode }) {
  return (
    <div className="vc-dato">
      <dt className="vc-sublabel">{label}</dt>
      <dd className="vc-field">
        <Icon name={icon} />
        <span>{children}</span>
      </dd>
    </div>
  );
}

/** Nota en línea (apagada y compacta, sin caja) con ícono; `wide` la extiende a todo el ancho de la rejilla. */
export function CardNote({ icon, accent = false, wide = false, children }: { icon: string; accent?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <p className={`vc-note ${accent ? 'vc-note--acento' : ''} ${wide ? 'vc-note--wide' : ''}`}>
      <Icon name={icon} />
      <span>{children}</span>
    </p>
  );
}
