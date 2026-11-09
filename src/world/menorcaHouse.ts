import { G, Merger } from '../entities/models';
import { setSurface, Surf } from '../core/surfaces';

// Las piezas de casa menorquina del capítulo 1 (Ferreries) para el decorado hecho con Merger: zócalo, cantoneras y
// cornisa de marès, ventanas con marco y alféizar de marès y persianas de lamas. Son las que llenan de tinta y de
// dibujo las fachadas del cap. 1; sin ellas, una casa es una caja blanca con agujeros. Con Merger cuestan poco:
// unas cajas por casa, sin texturas propias (el dibujo lo pone la superficie de cada color, ver comicSurfaces).

/** Marès claro (marcos, cantoneras, cornisas) y oscuro (zócalos). */
export const MARES = 0xe8d3ad;
export const MARES_DARK = 0xc9b596;
/** Persianas de lamas: verde menorquín, azul y blanca. */
export const LOUVRE_GREEN = 0x2f6b46;
export const LOUVRE_BLUE = 0x2b5f8a;
export const LOUVRE_WHITE = 0xf2f2ec;
/** Cristal apagado y ventana encendida. */
const PANE = 0x1b2440;
const LIT = 0xffd9a0;

setSurface(MARES, Surf.Mares);
setSurface(MARES_DARK, Surf.Mares);
setSurface(LOUVRE_BLUE, Surf.Louvre);
setSurface(LOUVRE_WHITE, Surf.Louvre);

/** Cara de una fachada: la normal va por el eje `axis` con signo `s`. */
export interface Face {
  axis: 'x' | 'z';
  s: 1 | -1;
}

/**
 * Ventana sobre la pared en (x, y, z) (el punto de la superficie, en su centro): marco y alféizar de marès,
 * cristal (o la luz de dentro) y persianas de lamas abiertas a los lados o cerradas delante.
 */
export function menorcaWindow(
  m: Merger,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  face: Face,
  o: { lit?: boolean; shutter?: number; closed?: boolean; frame?: number } = {},
) {
  const nx = face.axis === 'x' ? face.s : 0;
  const nz = face.axis === 'z' ? face.s : 0;
  const tx = face.axis === 'z' ? 1 : 0;
  const tz = face.axis === 'x' ? 1 : 0;
  // caja: `along` por la pared, `up` en altura, `out` hacia fuera; tamaños: sw a lo ancho, sh alto, sd de grueso
  const box = (color: number, along: number, up: number, out: number, sw: number, sh: number, sd: number) =>
    m.add(G.box, color, x + tx * along + nx * out, y + up, z + tz * along + nz * out, 0, 0, 0, face.axis === 'z' ? sw : sd, sh, face.axis === 'z' ? sd : sw);
  const frame = o.frame ?? MARES;
  const shutter = o.shutter ?? LOUVRE_GREEN;
  box(frame, 0, 0, 0.04, w + 0.36, h + 0.36, 0.08);
  box(o.lit ? LIT : PANE, 0, 0, 0.09, w, h, 0.04);
  // alféizar
  box(frame, 0, -h / 2 - 0.2, 0.12, w + 0.56, 0.1, 0.26);
  if (o.closed && !o.lit) box(shutter, 0, 0, 0.13, w + 0.04, h + 0.02, 0.05);
  else {
    // travesaño del cristal y las dos hojas de lamas abiertas, pegadas a la pared
    box(frame, 0, 0, 0.12, 0.07, h, 0.03);
    for (const sd of [-1, 1]) box(shutter, sd * (w / 2 + 0.2 + w / 4), 0, 0.1, w / 2, h + 0.02, 0.05);
  }
}

/**
 * Zócalo, cantoneras y cornisa de marès de un volumen de casa centrado en (cx, cz), de w (x) por d (z) y alto h
 * desde y0. Lo que hace que una caja encalada se lea como una casa del cap. 1.
 */
export function menorcaTrim(m: Merger, cx: number, y0: number, cz: number, w: number, d: number, h: number, o: { plinth?: boolean; cornice?: boolean } = {}) {
  if (o.plinth !== false) m.add(G.box, MARES_DARK, cx, y0 + 0.35, cz, 0, 0, 0, w + 0.08, 0.7, d + 0.08);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) m.add(G.box, MARES, cx + sx * (w / 2 - 0.16), y0 + h / 2, cz + sz * (d / 2 - 0.16), 0, 0, 0, 0.42, h, 0.42);
  if (o.cornice !== false) m.add(G.box, MARES, cx, y0 + h - 0.13, cz, 0, 0, 0, w + 0.22, 0.26, d + 0.22);
}
