import { describe, expect, it } from 'vitest';
import {
  applyOrder,
  distanceToBox,
  edgeScrollSpeed,
  flipTransform,
  liftOffset,
  moveInOrder,
  orderSignature,
  pickTargetIndex,
  sameOrder,
  tiltFor,
  type Box,
} from '@/features/dashboard/dragSort';
import { reorderVisible, type LayoutItem } from '@/features/dashboard/layout';

const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height });

/**
 * Tablero de 4 columnas (cada una 100 px, hueco 16) con tamaños mixtos, en orden de lectura:
 *   0: 1×1 (0,0)   1: 2×1 (116,0)   2: 1×1 (348,0)
 *   3: 4×1 (0,116)
 *   4: 2×2 (0,232) 5: 1×1 (232,232) 6: 1×1 (348,232)
 */
const MIXED: Box[] = [
  box(0, 0, 100, 100),
  box(116, 0, 216, 100),
  box(348, 0, 100, 100),
  box(0, 116, 448, 100),
  box(0, 232, 216, 216),
  box(232, 232, 100, 100),
  box(348, 232, 100, 100),
];

describe('distanceToBox', () => {
  it('es 0 dentro de la caja y crece fuera de ella', () => {
    expect(distanceToBox({ x: 50, y: 50 }, box(0, 0, 100, 100))).toBe(0);
    expect(distanceToBox({ x: 110, y: 50 }, box(0, 0, 100, 100))).toBe(100);
    expect(distanceToBox({ x: 103, y: 104 }, box(0, 0, 100, 100))).toBe(25);
  });
});

describe('pickTargetIndex (tamaños mixtos)', () => {
  it('elige la celda sobre la que está el puntero, sin importar su tamaño', () => {
    expect(pickTargetIndex(MIXED, { x: 50, y: 50 })).toBe(0);
    expect(pickTargetIndex(MIXED, { x: 200, y: 50 })).toBe(1);
    expect(pickTargetIndex(MIXED, { x: 400, y: 50 })).toBe(2);
    expect(pickTargetIndex(MIXED, { x: 300, y: 160 })).toBe(3);
    expect(pickTargetIndex(MIXED, { x: 100, y: 340 })).toBe(4);
    expect(pickTargetIndex(MIXED, { x: 380, y: 300 })).toBe(6);
  });

  it('en un hueco entre celdas toma la más cercana (sin parpadeos entre dos)', () => {
    // Hueco vertical entre la fila 1 y la banda 4×1 (100..116).
    expect(pickTargetIndex(MIXED, { x: 60, y: 105 })).toBe(0);
    expect(pickTargetIndex(MIXED, { x: 60, y: 112 })).toBe(3);
    // Hueco horizontal entre la 1×1 y la 2×1 (100..116).
    expect(pickTargetIndex(MIXED, { x: 105, y: 50 })).toBe(0);
    expect(pickTargetIndex(MIXED, { x: 112, y: 50 })).toBe(1);
  });

  it('fuera del tablero: arriba va al principio y abajo al final', () => {
    expect(pickTargetIndex(MIXED, { x: 10, y: -80 })).toBe(0);
    expect(pickTargetIndex(MIXED, { x: 400, y: 900 })).toBe(6);
  });

  it('es estable: depende solo de la geometría inicial y del puntero (mismo punto, mismo índice)', () => {
    const point = { x: 232, y: 270 };
    const first = pickTargetIndex(MIXED, point);
    for (let i = 0; i < 5; i++) expect(pickTargetIndex(MIXED, point)).toBe(first);
    expect(first).toBe(5);
  });

  it('con una sola celda (o ninguna) devuelve 0', () => {
    expect(pickTargetIndex([box(0, 0, 10, 10)], { x: 500, y: 500 })).toBe(0);
    expect(pickTargetIndex([], { x: 1, y: 1 })).toBe(0);
  });
});

describe('moveInOrder / applyOrder', () => {
  const order = ['a', 'b', 'c', 'd'];

  it('lleva un id a otra posición sin mutar el original', () => {
    expect(moveInOrder(order, 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveInOrder(order, 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(order).toEqual(['a', 'b', 'c', 'd']);
  });

  it('acota la posición y tolera ids desconocidos', () => {
    expect(moveInOrder(order, 'a', 99)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveInOrder(order, 'b', -5)).toEqual(['b', 'a', 'c', 'd']);
    expect(moveInOrder(order, 'x', 1)).toEqual(order);
  });

  it('coincide con reorderVisible: el índice destino es el índice final del widget', () => {
    const items: LayoutItem[] = [
      { id: 'kpi_alerts', size: 's', visible: true },
      { id: 'kpi_citas', size: 's', visible: true },
      { id: 'alerts', size: 'l', visible: true },
      { id: 'cases', size: 'm', visible: true },
    ];
    const ids: string[] = items.map((i) => i.id);
    for (const to of [0, 1, 2, 3]) {
      const expected = reorderVisible(items, 'kpi_alerts', to).map((i) => i.id);
      expect(moveInOrder(ids, 'kpi_alerts', to)).toEqual(expected);
    }
  });

  it('applyOrder ordena por el borrador y deja al final lo que el borrador no conoce', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(applyOrder(items, ['c', 'a', 'b']).map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(applyOrder(items, ['c']).map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(applyOrder(items, ['z', 'b']).map((i) => i.id)).toEqual(['b', 'a', 'c']);
    expect(applyOrder(items, null)).toEqual(items);
  });

  it('sameOrder compara posición a posición', () => {
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameOrder(['a'], ['a', 'b'])).toBe(false);
  });

  it('orderSignature cambia con el orden, el tamaño o lo que empuja el tablero', () => {
    const base = [
      { id: 'a', size: 's' },
      { id: 'b', size: 'm' },
    ];
    const sig = orderSignature(base);
    expect(orderSignature([...base].reverse())).not.toBe(sig);
    expect(orderSignature([{ id: 'a', size: 'l' }, base[1]])).not.toBe(sig);
    expect(orderSignature(base, 'panel')).not.toBe(sig);
    expect(orderSignature(base)).toBe(sig);
  });
});

describe('flipTransform', () => {
  it('sin cambio perceptible no anima', () => {
    expect(flipTransform(box(10, 10, 100, 100), box(10.2, 10.2, 100.2, 100))).toBeNull();
  });

  it('un movimiento puro es traslación (de donde estaba hacia donde está)', () => {
    expect(flipTransform(box(0, 0, 100, 100), box(116, 0, 100, 100))).toEqual({
      dx: -116,
      dy: 0,
      sx: 1,
      sy: 1,
      resized: false,
    });
  });

  it('un cambio de tamaño agrega escala primero ÷ último', () => {
    const t = flipTransform(box(0, 0, 100, 100), box(0, 0, 216, 100));
    expect(t?.resized).toBe(true);
    expect(t?.sx).toBeCloseTo(100 / 216);
    expect(t?.sy).toBe(1);
    const shrink = flipTransform(box(0, 0, 448, 216), box(0, 0, 100, 100));
    expect(shrink?.sx).toBeCloseTo(4.48);
    expect(shrink?.sy).toBeCloseTo(2.16);
  });

  it('una caja final sin tamaño no produce escalas infinitas', () => {
    const t = flipTransform(box(0, 0, 100, 100), box(0, 0, 0, 0));
    expect(Number.isFinite(t?.sx)).toBe(true);
    expect(Number.isFinite(t?.sy)).toBe(true);
  });
});

describe('liftOffset', () => {
  it('conserva el punto de agarre: el widget no salta bajo el puntero', () => {
    const slot = { left: 116, top: 0 };
    const grab = { x: 30, y: 20 };
    // Al empezar, el puntero está sobre el punto de agarre: desplazamiento 0.
    expect(liftOffset({ x: 146, y: 20 }, grab, slot)).toEqual({ x: 0, y: 0 });
    // Moverse 50 px a la derecha y 10 abajo desplaza la capa lo mismo.
    expect(liftOffset({ x: 196, y: 30 }, grab, slot)).toEqual({ x: 50, y: 10 });
  });

  it('si el hueco se mueve por el reacomodo, la capa se compensa y sigue bajo el puntero', () => {
    const grab = { x: 30, y: 20 };
    const pointer = { x: 400, y: 250 };
    const before = liftOffset(pointer, grab, { left: 0, top: 0 });
    const after = liftOffset(pointer, grab, { left: 116, top: 116 });
    // posición visual = hueco + desplazamiento: idéntica antes y después.
    expect(0 + before.x).toBe(116 + after.x);
    expect(0 + before.y).toBe(116 + after.y);
  });
});

describe('edgeScrollSpeed', () => {
  it('no se mueve lejos de los bordes', () => {
    expect(edgeScrollSpeed(400, 0, 800)).toBe(0);
  });

  it('acelera de forma suave hacia el borde correspondiente y se acota', () => {
    const near = edgeScrollSpeed(60, 0, 800);
    const nearer = edgeScrollSpeed(10, 0, 800);
    expect(near).toBeLessThan(0);
    expect(nearer).toBeLessThan(near);
    expect(edgeScrollSpeed(-50, 0, 800)).toBe(-18);
    expect(edgeScrollSpeed(790, 0, 800)).toBeGreaterThan(edgeScrollSpeed(760, 0, 800));
    expect(edgeScrollSpeed(900, 0, 800)).toBe(18);
  });

  it('no hace scroll si la ventana es demasiado baja para tener zonas de borde', () => {
    expect(edgeScrollSpeed(10, 0, 100)).toBe(0);
  });
});

describe('tiltFor', () => {
  it('nunca supera 1° y sigue el sentido del movimiento', () => {
    expect(tiltFor(0)).toBe(0);
    expect(tiltFor(3)).toBeCloseTo(0.36);
    expect(tiltFor(500)).toBe(1);
    expect(tiltFor(-500)).toBe(-1);
  });
});
