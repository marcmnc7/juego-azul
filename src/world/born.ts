import * as THREE from 'three';
import { TownHD } from './hd/townHD';
import { G, Merger, araucaria, makeCar, streetLamp } from '../entities/models';
import { toon, glowTexture } from '../core/gfx';
import { Surf } from '../core/surfaces';
import { canvasTex } from './deco';
import type { Box2 } from './ferreries';
import { barDoorTexture, barSignTexture, shutterTexture } from './homeStreet';

// La Plaça des Born de Ciutadella, compartida por el capítulo 2 (el Bar Imperi) y Sant Joan.
// Como la ve quien entra desde Ses Voltes (por el este, mirando al oeste):
// - al fondo a la izquierda, el Bar Imperi; al fondo a la derecha, el Ajuntament con su torre;
// - en el lateral izquierdo (norte), Correus y el Teatre des Born; en el derecho (sur), Es Casino Nou
//   y el Palau Torre-Saura;
// - el obelisco está en una explanada más alta, con bordillo, y alrededor, hasta las fachadas, una
//   calle de coches con su acera.
// Coordenadas locales: el obelisco en el origen; la entrada de Ses Voltes en x = 18, z ∈ [-4.4, 4.4].

export const BORN = { minX: -18, maxX: 18, minZ: -14, maxZ: 14 };
/** La explanada alta del obelisco. */
export const BORN_TOP = { minX: -12, maxX: 12, minZ: -9, maxZ: 9 };
export const BORN_RISE = 0.25;
/** Carril de la calle del lado sur (z local), por donde pasan los coches. */
export const BORN_SOUTH_LANE = -10.6;
/** Puerta del Bar Imperi (local) y hacia dónde da su fachada (+x). */
export const IMPERI = new THREE.Vector3(-18, 0, 7);
export const CORREUS = new THREE.Vector3(0, 0, 14);
const SIDEWALK = 1.8;

/** Altura del suelo en (x, z) locales: la explanada está un escalón por encima de la calle. */
export function bornHeight(x: number, z: number) {
  const t = BORN_TOP;
  const d = Math.max(t.minX - x, x - t.maxX, t.minZ - z, z - t.maxZ);
  // Bordillo: rampa corta de 0,2 m para que al subir no haya un salto seco
  // (acaba donde acaba el bordillo que se ve, 15 cm más allá de la explanada: si no, los pies se hundían en él)
  return d <= 0.05 ? BORN_RISE : d >= 0.25 ? 0 : BORN_RISE * (0.25 - d) / 0.2;
}

const SAND = 0xe6d2a8;
const OCHRE = 0xd8b483;
const WHITE = 0xf4f0e6;
const KERB = 0xcfc6b4;

export interface BornOpts {
  /** Coches aparcados (en Sant Joan la calle está cerrada). */
  cars?: boolean;
  /** Ses Voltes sigue (Sant Joan); si no, la calle se cierra con una fachada a los pocos metros. */
  voltes?: boolean;
  night?: boolean;
}

export interface BornWorld {
  group: THREE.Group;
  /** Puntos de luz de las farolas (locales). */
  lamps: [number, number][];
}

/**
 * Plano partido en trozos de ~0,4 m: el decorado se comba a mano alzada (comic.ts) y un plano de una sola pieza
 * (cartel, puerta, persiana) se quedaba recto; lo de detrás, combado, lo atravesaba a manchas.
 */
function bendable(w: number, h: number) {
  return new THREE.PlaneGeometry(w, h, Math.max(1, Math.ceil(w / 0.4)), Math.max(1, Math.ceil(h / 0.4)));
}

function sign(g: THREE.Group, text: string, x: number, y: number, z: number, ry: number, w = 3.2, bg = '#f4efe2', fg = '#2a1a2e') {
  const tex = canvasTex(
    (ctx, cw, ch) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = fg;
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, cw - 16, ch - 16);
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = 84;
      do ctx.font = `bold ${size}px Georgia, serif`;
      while (ctx.measureText(text).width > cw - 60 && (size -= 4) > 20);
      ctx.fillText(text, cw / 2, ch / 2 + 4);
    },
    512,
    128,
  );
  // (con luz: de noche, un rótulo de piedra no brilla solo)
  const s = new THREE.Mesh(bendable(w, w * 0.25), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  s.position.set(x, y, z);
  s.rotation.y = ry;
  g.add(s);
}

/**
 * Silla de director de la terraza del Imperi: dos costados de madera (patas, la de atrás alta hasta el respaldo,
 * y brazo), lona verde de asiento y de respaldo tensada entre ellos y las patas en aspa. s: hacia dónde queda la
 * espalda (+1, +z; -1, -z); la silla mira a la mesa.
 */
function directorChair(m: Merger, x: number, z: number, s: number) {
  const WOOD = 0x8a5a34, CANVAS = 0x1f5a45;
  const front = z - s * 0.2, back = z + s * 0.2;
  for (const sx of [-0.25, 0.25]) {
    m.add(G.box, WOOD, x + sx, 0.33, front, 0, 0, 0, 0.05, 0.66, 0.05); // pata delantera, hasta el brazo
    m.add(G.box, WOOD, x + sx, 0.47, back, 0, 0, 0, 0.05, 0.94, 0.05); // pata trasera, hasta arriba del respaldo
    m.add(G.box, WOOD, x + sx, 0.68, z, 0, 0, 0, 0.07, 0.04, 0.5); // brazo
    m.add(G.box, WOOD, x + sx, 0.24, z, s * 0.62, 0, 0, 0.04, 0.5, 0.04); // aspa
    m.add(G.box, WOOD, x + sx, 0.24, z, -s * 0.62, 0, 0, 0.04, 0.5, 0.04);
  }
  m.add(G.box, CANVAS, x, 0.46, z, 0, 0, 0, 0.46, 0.03, 0.4); // asiento
  m.add(G.box, CANVAS, x, 0.82, back, 0, 0, 0, 0.5, 0.22, 0.03); // respaldo, entre las patas traseras
}

/** Construye el Born en `origin` (el obelisco) y añade sus obstáculos a `colliders` en coordenadas del mundo. */
export function buildBorn(sc: THREE.Scene, colliders: Box2[], origin: THREE.Vector3, opts: BornOpts = {}): BornWorld {
  const g = new THREE.Group();
  g.position.copy(origin);
  const ox = origin.x;
  const oz = origin.z;
  const col = (minX: number, maxX: number, minZ: number, maxZ: number, low = false) => colliders.push({ minX: minX + ox, maxX: maxX + ox, minZ: minZ + oz, maxZ: maxZ + oz, low });
  const m = new Merger();

  let blockN = 0;
  // Con superficies de alta calidad, las manzanas como en Ferreries
  const hd = new TownHD();
  const block = (x0: number, x1: number, z0: number, z1: number, h: number, color: number) => {
    // Cada bloque unos milímetros distinto: dos manzanas en el mismo plano parpadean
    const e = (blockN++ % 6) * 0.012 + 0.006;
    if (hd) hd.wall(x0, x1, z0, z1, h, color);
    else {
      m.add(G.box, color, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, 0, 0, 0, x1 - x0 - e, h, z1 - z0 - e);
      m.add(G.box, 0xcdbb98, (x0 + x1) / 2, h + 0.12 + e / 2, (z0 + z1) / 2, 0, 0, 0, x1 - x0 + 0.2 - e, 0.24, z1 - z0 + 0.2 - e);
    }
    col(x0, x1, z0, z1);
  };
  /** Ventanas con persianas verdes menorquinas y balcones. along: fachada a lo largo de x (si no, de z). */
  const facade = (a0: number, a1: number, at: number, face: 1 | -1, floors: number, alongX = true) => {
    if (hd) return hd.facade(a0, a1, at, face, floors, alongX);
    const len = Math.abs(a1 - a0);
    const n = Math.max(1, Math.floor(len / 3));
    for (let f = 0; f < floors; f++)
      for (let i = 0; i < n; i++) {
        const a = Math.min(a0, a1) + (i + 0.5) * (len / n);
        const y = 1.6 + f * 3.1 + (f > 0 ? 0.6 : 0);
        const off = face * 0.06;
        const c = f === 0 ? 0x5a3a26 : 0x2f6b46;
        if (alongX) {
          m.add(G.box, c, a, y, at + off, 0, 0, 0, 1.1, f === 0 ? 2.4 : 1.7, 0.08);
          if (f > 0 && i % 2 === 0) m.add(G.box, 0x2a2a2a, a, y - 0.95, at + face * 0.4, 0, 0, 0, 1.6, 0.08, 0.8);
        } else {
          m.add(G.box, c, at + off, y, a, 0, 0, 0, 0.08, f === 0 ? 2.4 : 1.7, 1.1);
          if (f > 0 && i % 2 === 0) m.add(G.box, 0x2a2a2a, at + face * 0.4, y - 0.95, a, 0, 0, 0, 0.8, 0.08, 1.6);
        }
      }
  };

  // --- Suelo: calle de asfalto alrededor, aceras de losas junto a las fachadas y la explanada alta ---
  // Sin Ses Voltes, la calle sigue unos metros hacia el este (luego la cierra una casa)
  const extra = opts.voltes ? 0 : 12;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(BORN.maxX - BORN.minX + extra, BORN.maxZ - BORN.minZ).rotateX(-Math.PI / 2), toon({ color: 0x4a4a50, roughness: 0.92, surf: Surf.Asphalt }));
  road.position.set(extra / 2, 0.02, 0);
  road.userData.noCast = true;
  g.add(road);
  const walkMat = toon({ color: 0xd8cfbd, roughness: 0.9, surf: Surf.Paving });
  const walk = (x0: number, x1: number, z0: number, z1: number) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), walkMat);
    p.position.set((x0 + x1) / 2, 0.035, (z0 + z1) / 2);
    p.userData.noCast = true;
    g.add(p);
    // Bordillo de la acera
    const kx = x1 - x0 < z1 - z0;
    m.add(G.box, KERB, kx ? (x0 > 0 ? x0 : x1) : (x0 + x1) / 2, 0.06, kx ? (z0 + z1) / 2 : z0 > 0 ? z0 : z1, 0, 0, 0, kx ? 0.18 : x1 - x0, 0.12, kx ? z1 - z0 : 0.18);
  };
  walk(BORN.minX, BORN.maxX, BORN.maxZ - SIDEWALK, BORN.maxZ);
  walk(BORN.minX, BORN.maxX, BORN.minZ, BORN.minZ + SIDEWALK);
  walk(BORN.minX, BORN.minX + SIDEWALK, BORN.minZ + SIDEWALK, BORN.maxZ - SIDEWALK);
  walk(BORN.maxX - SIDEWALK, BORN.maxX, BORN.minZ + SIDEWALK, -4.4);
  walk(BORN.maxX - SIDEWALK, BORN.maxX, 4.4, BORN.maxZ - SIDEWALK);
  // Marcas viales: líneas de borde y pasos de cebra hacia Ses Voltes, Correus y el Bar Imperi
  const T = BORN_TOP;
  const lines = new Merger();
  for (const z of [T.maxZ + 0.35, T.minZ - 0.35]) lines.add(G.box, 0xf2f0ea, 0, 0.03, z, 0, 0, 0, T.maxX - T.minX + 0.7, 0.01, 0.1);
  for (const x of [T.maxX + 0.35, T.minX - 0.35]) lines.add(G.box, 0xf2f0ea, x, 0.03, 0, 0, 0, 0, 0.1, 0.01, T.maxZ - T.minZ + 0.7);
  for (let i = 0; i < 6; i++) {
    lines.add(G.box, 0xf2f0ea, T.maxX + 2.1, 0.03, -2.25 + i * 0.9, 0, 0, 0, 3.2, 0.01, 0.5); // hacia Ses Voltes
    lines.add(G.box, 0xf2f0ea, -0.25 * 0 - 2.25 + i * 0.9, 0.03, T.maxZ + 1.6, 0, 0, 0, 0.5, 0.01, 2.6); // hacia Correus
    lines.add(G.box, 0xf2f0ea, T.minX - 2.1, 0.03, IMPERI.z - 2.25 + i * 0.9, 0, 0, 0, 3.2, 0.01, 0.5); // hacia el Imperi
  }
  const lm = lines.mesh();
  lm.userData.noCast = true;
  g.add(lm);
  // La explanada: zócalo de piedra con bordillo y adoquín rojizo encima
  m.add(G.box, KERB, 0, BORN_RISE / 2, 0, 0, 0, 0, T.maxX - T.minX + 0.3, BORN_RISE, T.maxZ - T.minZ + 0.3);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(T.maxX - T.minX, T.maxZ - T.minZ).rotateX(-Math.PI / 2), toon({ color: 0xc09478, roughness: 0.95, surf: Surf.Cobble }));
  top.position.y = BORN_RISE + 0.012;
  top.userData.noCast = true;
  g.add(top);
  const R = BORN_RISE;

  // --- Obelisco (1857): 22 m de marès sobre zócalo escalonado, lápidas, verja de hierro y césped ---
  for (let i = 0; i < 3; i++) m.add(G.box, 0xc9b48c, 0, R + 0.15 + i * 0.3, 0, 0, 0, 0, 4.2 - i * 0.6, 0.3, 4.2 - i * 0.6);
  m.add(G.box, 0xd6c29a, 0, R + 2.05, 0, 0, 0, 0, 2.2, 2.2, 2.2);
  for (const [dx, dz, ry] of [[0, 1.11, 0], [0, -1.11, 0], [1.11, 0, Math.PI / 2], [-1.11, 0, Math.PI / 2]] as [number, number, number][])
    for (const o of [-0.5, 0.5]) {
      const lx = ry ? 0 : o, lz = ry ? o : 0;
      m.add(G.box, 0xc4b08a, dx + lx, R + 2.1, dz + lz, 0, ry, 0, 0.7, 0.95, 0.04);
      m.add(G.box, 0xb5a07a, dx + lx, R + 2.1, dz + lz, 0, ry, 0, 0.6, 0.85, 0.05);
    }
  for (const [cx, cz] of [[0.75, 0.75], [-0.75, 0.75], [0.75, -0.75], [-0.75, -0.75]]) m.add(G.box, 0xcdb994, cx, R + 4.15, cz, 0, Math.PI / 4, 0, 0.5, 0.6, 0.5);
  m.add(G.cyl, 0x4f7a3a, 0, R + 0.03, 0, 0, 0, 0, 6.0, 0.04, 6.0);
  m.add(G.box, 0xcdb994, 0, R + 3.3, 0, 0, 0, 0, 2.5, 0.3, 2.5);
  m.add(G.box, 0xd6c29a, 0, R + 3.9, 0, 0, 0, 0, 1.7, 0.9, 1.7);
  m.add(new THREE.CylinderGeometry(0.42, 0.78, 1, 4), 0xdcc8a2, 0, R + 11.4, 0, 0, Math.PI / 4, 0, 1, 14.2, 1);
  m.add(new THREE.ConeGeometry(0.5, 1, 4), 0xdcc8a2, 0, R + 19.2, 0, 0, Math.PI / 4, 0, 0.62, 1.4, 0.62);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    m.add(G.cyl, 0x1e1e1e, Math.cos(a) * 3.1, R + 0.6, Math.sin(a) * 3.1, 0, 0, 0, 0.05, 1.2, 0.05);
    m.add(new THREE.ConeGeometry(0.06, 0.16, 4), 0x1e1e1e, Math.cos(a) * 3.1, R + 1.28, Math.sin(a) * 3.1, 0, 0, 0, 1, 1, 1);
  }
  m.add(new THREE.TorusGeometry(3.1, 0.04, 4, 48), 0x1e1e1e, 0, R + 1.05, 0, Math.PI / 2, 0, 0, 1, 1, 1);
  m.add(new THREE.TorusGeometry(3.1, 0.04, 4, 48), 0x1e1e1e, 0, R + 0.25, 0, Math.PI / 2, 0, 0, 1, 1, 1);
  for (const [fx, fz] of [[2.19, 2.19], [-2.19, 2.19], [2.19, -2.19], [-2.19, -2.19]]) {
    m.add(G.cyl, 0x1e1e1e, fx, R + 2, fz, 0, 0, 0, 0.12, 4, 0.12);
    m.add(G.box, 0xf4e6c0, fx, R + 4.2, fz, 0, Math.PI / 4, 0, 0.45, 0.6, 0.45);
  }
  // (la cámara pasa por encima de la verja y la peana; si no, se pegaba a Azul al andar junto al obelisco)
  // La verja es redonda: con una caja, Azul chocaba en las esquinas del cuadrado sin tocar nada
  colliders.push({ minX: -3.14 + ox, maxX: 3.14 + ox, minZ: -3.14 + oz, maxZ: 3.14 + oz, low: true, round: true }); // la verja está a 3,1 m

  // --- Oeste, al fondo a la derecha: el Ajuntament (antiguo alcázar): almenas, ojivas y torre ---
  const W = BORN.minX;
  block(W - 9, W, BORN.minZ, 0.5, 11, OCHRE);
  for (let z = BORN.minZ + 0.4; z <= 0.2; z += 1.2) m.add(G.box, OCHRE, W + 0.2, 11.6, z, 0, 0, 0, 0.5, 1.2, 0.7);
  m.add(G.box, OCHRE, W - 1.5, 8, -6.5, 0, 0, 0, 3.4, 16, 5); // torre
  for (let z = -8.6; z <= -4.4; z += 1.05) m.add(G.box, OCHRE, W + 0.3, 16.5, z, 0, 0, 0, 0.5, 1, 0.6);
  m.add(G.box, 0x4a3020, W + 0.25, 2.2, -6.5, 0, 0, 0, 0.1, 4.4, 3);
  m.add(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 16, 1, false, 0, Math.PI), 0x4a3020, W + 0.25, 4.4, -6.5, 0, 0, Math.PI / 2, 1, 1, 1);
  m.add(G.box, 0xb8955f, W + 0.3, 5.6, -6.5, 0, 0, 0, 0.3, 0.25, 3.8);
  m.add(G.cyl, 0xf4efe2, W + 0.28, 13.6, -6.5, 0, 0, Math.PI / 2, 1.6, 0.06, 1.6); // reloj
  m.add(G.cyl, 0x2a2a2a, W + 0.32, 13.6, -6.5, 0, 0, Math.PI / 2, 0.16, 0.05, 0.16);
  m.add(G.box, 0x2a2a2a, W + 0.34, 13.85, -6.5, 0, 0, 0, 0.02, 0.55, 0.05);
  m.add(G.box, 0x2a2a2a, W + 0.34, 13.6, -6.32, 0, 0, 0, 0.02, 0.05, 0.4);
  for (let z = BORN.minZ + 1.2; z <= -0.6; z += 2.4) {
    if (Math.abs(z + 6.5) < 2.5) continue;
    for (const y of [2.6, 6.4]) {
      m.add(G.box, 0x3a2a20, W + 0.06, y, z, 0, 0, 0, 0.06, 1.8, 0.9);
      m.add(new THREE.ConeGeometry(0.62, 0.7, 4), 0xb8955f, W + 0.08, y + 1.15, z, 0, Math.PI / 4, 0, 0.12, 1, 1);
    }
    m.add(G.box, 0x2a2a2a, W + 0.4, 5.3, z, 0, 0, 0, 0.6, 0.08, 1.3);
  }
  for (let z = BORN.minZ + 0.6; z <= 0; z += 1.1) m.add(G.box, 0x3a2a20, W + 0.06, 9.6, z, 0, 0, 0, 0.06, 1.3, 0.6); // galería alta
  sign(g, 'AJUNTAMENT', W + 0.24, 7.2, -6.5, Math.PI / 2, 5); // (por delante de la torre, no dentro)

  // --- Oeste, al fondo a la izquierda: el Bar Imperi (fachada amarilla, puerta verde, rótulo cursivo) ---
  const B = IMPERI;
  block(W - 9, W, 0.5, BORN.maxZ, 8, 0xf0c24f);
  m.add(G.box, WHITE, W + 0.03, 0.15, (0.5 + BORN.maxZ) / 2, 0, 0, 0, 0.08, 0.3, BORN.maxZ - 0.5); // zócalo
  m.add(G.box, WHITE, W + 0.04, 1.6, B.z, 0, 0, 0, 0.08, 3.2, 2.6);
  const door = new THREE.Mesh(bendable(1.8, 2.7), new THREE.MeshBasicMaterial({ map: barDoorTexture(), color: 0xe6e6e6 }));
  door.position.set(W + 0.12, 1.35, B.z);
  door.rotation.y = Math.PI / 2;
  // El rótulo, separado del marco negro y partido en trozos, para que se comben juntos sin que el marco lo atraviese
  const bs = new THREE.Mesh(bendable(3.4, 0.74), new THREE.MeshBasicMaterial({ map: barSignTexture(), color: 0xf0f0f0 }));
  bs.position.set(W + 0.17, 3.75, B.z);
  bs.rotation.y = Math.PI / 2;
  m.add(G.box, 0x2b2b2b, W + 0.08, 3.75, B.z, 0, 0, 0, 0.06, 0.84, 3.5);
  const shutter = toon({ map: shutterTexture(), color: 0xffffff });
  for (const [z, y, w, h] of [[B.z, 6.0, 2.0, 1.4], [B.z - 3.4, 1.35, 1.3, 1.5], [B.z + 3.6, 6.0, 1.6, 1.4], [B.z - 3.4, 6.0, 1.6, 1.4]] as [number, number, number, number][]) {
    const sh = new THREE.Mesh(bendable(w, h), shutter);
    sh.position.set(W + 0.12, y, z);
    sh.rotation.y = Math.PI / 2;
    g.add(sh);
    m.add(G.box, WHITE, W + 0.05, y, z, 0, 0, 0, 0.06, h + 0.3, w + 0.4);
  }
  g.add(door, bs);
  for (const s of [-1, 1]) {
    m.add(G.box, 0x2b2b2b, W + 0.25, 3.75, B.z + s * 2.3, 0, 0, 0, 0.5, 0.06, 0.06);
    m.add(G.cone, 0x2b2b2b, W + 0.5, 3.65, B.z + s * 2.3, 0, 0, 0, 0.42, 0.22, 0.42);
  }
  // Toldo blanco y la terraza en la acera: mesas de madera y sillas de director verdes
  m.add(G.box, 0xf2efe6, W + 1.1, 3.05, B.z + 4.4, 0, 0, 0.28, 2.0, 0.06, 4.4);
  m.add(G.box, 0xe0dccf, W + 2.05, 2.7, B.z + 4.4, 0, 0, 0, 0.04, 0.3, 4.4);
  const table = (x: number, z: number) => {
    m.add(G.box, 0x9a6a40, x, 0.72, z, 0, 0, 0, 0.7, 0.05, 0.7);
    for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) m.add(G.box, 0x8a5a34, x + dx, 0.36, z + dz, 0, 0, 0, 0.05, 0.72, 0.05);
    m.add(G.cyl, 0xffffff, x + 0.12, 0.78, z, 0, 0, 0, 0.12, 0.08, 0.12);
    for (const s of [-1, 1]) directorChair(m, x, z + s * 0.62, s);
    col(x - 0.5, x + 0.5, z - 0.95, z + 0.95);
  };
  table(W + 0.95, B.z + 3.6);
  table(W + 0.95, B.z + 5.6);
  table(W + 0.95, B.z - 3.2);

  // --- Norte (lateral izquierdo): Teatre des Born, Correus y una casa ---
  const N = BORN.maxZ;
  block(-18, -6, N, N + 8, 11, 0xe7d3b0);
  for (let x = -16.6; x <= -7.4; x += 1.84) m.add(G.cyl, 0xf3ead6, x, 4.2, N - 0.3, 0, 0, 0, 0.55, 8.4, 0.55);
  m.add(G.box, 0xf3ead6, -12, 8.7, N - 0.3, 0, 0, 0, 11, 0.6, 0.9);
  m.add(new THREE.ConeGeometry(1, 1, 3), 0xf3ead6, -12, 10.1, N - 0.1, Math.PI / 2, 0, Math.PI, 6.4, 0.5, 2.2);
  for (const x of [-14.2, -12, -9.8]) m.add(G.box, 0x3a2a20, x, 2, N - 0.03, 0, 0, 0, 1.3, 3, 0.06);
  col(-17.2, -6.8, N - 0.6, N);
  sign(g, 'Teatre des Born', -12, 6.6, N - 0.8, Math.PI, 3.4);
  block(-6, 6, N, N + 8, 10, 0xf1d9a0);
  facade(-6, 6, N, -1, 2);
  sign(g, 'CORREUS', 0, 3.12, N - 0.1, Math.PI, 3.6, '#f6c700', '#1f3f8f'); // (debajo de los balcones, no cruzado por ellos)
  m.add(G.box, 0xf6c700, 3.2, 1.0, N - 0.25, 0, 0, 0, 0.5, 0.9, 0.4); // buzón amarillo
  col(2.9, 3.5, N - 0.5, N);
  block(6, 18, N, N + 8, 9, SAND);
  facade(6, 18, N, -1, 2);

  // --- Sur (lateral derecho): Es Casino Nou, el Palau Torre-Saura y una casa ---
  const S = BORN.minZ;
  block(-18, -4, S - 9, S, 12, SAND);
  facade(-18, -4, S, 1, 3);
  for (let x = -16.5; x <= -5.5; x += 2.2) {
    m.add(G.box, 0x3a2a20, x, 10.2, S + 0.06, 0, 0, 0, 1.2, 2, 0.06);
    m.add(G.box, 0xf2ead6, x + 1.1, 10.2, S + 0.2, 0, 0, 0, 0.3, 2.6, 0.3); // logia
  }
  m.add(new THREE.ConeGeometry(1, 1, 3), 0xe9dcbc, -11, 13.7, S + 0.2, Math.PI / 2, 0, 0, 6, 0.4, 2.4);
  sign(g, 'Palau Torre-Saura', -11, 3.12, S + 0.1, 0, 3.6);
  // Casino: fachada señorial clara con pilastras, balcón corrido y ventanales
  block(-4, 12, S - 9, S, 11, 0xefe4cc);
  for (let x = -3.4; x <= 11.4; x += 2.1) m.add(G.box, 0xf8f2e2, x, 5.5, S + 0.1, 0, 0, 0, 0.4, 11, 0.2);
  for (let x = -2.35; x <= 10.4; x += 2.1) {
    m.add(G.box, 0x3a2a20, x, 2.0, S + 0.06, 0, 0, 0, 1.2, 3.0, 0.06);
    m.add(G.box, 0x2f6b46, x, 6.4, S + 0.06, 0, 0, 0, 1.1, 2.0, 0.06);
    m.add(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 12, 1, false, 0, Math.PI), 0xf8f2e2, x, 7.45, S + 0.1, Math.PI / 2, 0, Math.PI / 2, 1, 1, 1);
  }
  m.add(G.box, 0x2a2a2a, 4, 5.25, S + 0.55, 0, 0, 0, 15.6, 0.08, 1.0); // balcón corrido
  m.add(G.box, 0x2a2a2a, 4, 5.75, S + 1.02, 0, 0, 0, 15.6, 0.9, 0.04);
  sign(g, 'Es Casino Nou', 4, 9.4, S + 0.24, 0, 4.2); // (por delante de las pilastras)
  block(12, 18, S - 9, S, 9, 0xeee3c8);
  facade(12, 18, S, 1, 2);

  // --- Esquinas y este: las manzanas a los lados de Ses Voltes ---
  for (const [x0, x1, z0, z1] of [[W - 9, W, N, N + 8], [W - 9, W, S - 9, S], [18, 30, N, N + 8], [18, 30, S - 9, S]]) block(x0, x1, z0, z1, 10, SAND);
  block(18, 30, S, -4.6, 10, 0xeee3c8);
  // (en Sant Joan, detrás de esta esquina está la plaza de la Catedral: un bloque aquí la tapaba entera)
  block(18, opts.voltes ? 19 : 30, 4.6, N, 10, SAND);
  facade(S, -4.6, 18, -1, 2, false);
  facade(4.6, N, 18, -1, 2, false);
  sign(g, 'Plaça des Born', 17.9, 3, -7, -Math.PI / 2, 3.2);
  if (!opts.voltes) {
    // La calle de Ses Voltes, cerrada a los pocos metros por una casa
    block(30, 38, -6, 6, 10, WHITE);
    facade(-4.6, 4.6, 30, -1, 2, false);
    sign(g, 'Ses Voltes', 29.92, 2.7, 0, -Math.PI / 2, 3); // (en la casa del fondo: antes flotaba en mitad de la calle)
  }

  // --- Farolas fernandinas, ficus, araucaria y palmeras en la explanada ---
  const lamps: [number, number][] = [];
  for (const [x, z] of [[-11.3, -8.3], [-11.3, 8.3], [11.3, -8.3], [11.3, 8.3], [0, 8.4], [0, -8.4], [-11.3, 0], [11.3, 0]]) {
    streetLamp(m, x, R, z);
    col(x - 0.25, x + 0.25, z - 0.25, z + 0.25);
    lamps.push([x, z]);
  }
  araucaria(m, 8.5, R, -6, 16, 4.2);
  col(8.1, 8.9, -6.4, -5.6);
  for (const [x, z] of [[-8.5, 6.2], [8.5, 6.2], [-8.5, -6.2]]) {
    // (la copa, alta: a la altura de la cámara la tapaba al pasar por debajo)
    m.add(G.cyl, 0x7a6a56, x, R + 2.6, z, 0, 0, 0, 0.5, 5.2, 0.5);
    for (let k = 0; k < 6; k++) m.add(G.bush, k % 2 ? 0x3d7a34 : 0x4a8a3c, x + Math.cos(k) * 1.8, R + 6.0 + Math.sin(k * 2) * 0.5, z + Math.sin(k) * 1.4, 0, k, 0, 2.6, 1.8, 2.2);
    m.add(G.cyl, KERB, x, R + 0.06, z, 0, 0, 0, 1.4, 0.12, 1.4); // alcorque
    col(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
  }
  // Bancos de piedra en la explanada
  for (const [x, z, ry] of [[-6, 7.9, 0], [6, 7.9, 0], [-6, -7.9, 0], [3, -7.9, 0]] as [number, number, number][]) {
    m.add(G.box, 0xd9cdb4, x, R + 0.42, z, 0, ry, 0, 2.2, 0.1, 0.55);
    for (const s of [-0.8, 0.8]) m.add(G.box, 0xc9bda4, x + s, R + 0.2, z, 0, 0, 0, 0.25, 0.4, 0.45);
    col(x - 1.1, x + 1.1, z - 0.3, z + 0.3);
  }

  // Coches aparcados en la calle (lado de las fachadas)
  if (opts.cars) {
    const cols = [0xd7263d, 0xf2f2f2, 0x2a3a5a, 0x8a8a8a];
    for (const [x, z, ry, c] of [[-6, 11.6, Math.PI / 2, 0], [8, 11.6, Math.PI / 2, 1], [-15.2, -3, 0, 2], [5, -12.1, -Math.PI / 2, 3]] as [number, number, number, number][]) {
      const car = makeCar(cols[c], { luggage: false, joy: false, empty: true });
      car.root.position.set(x, 0, z);
      car.root.rotation.y = ry;
      g.add(car.root);
      const along = Math.abs(Math.sin(ry)) > 0.5;
      col(x - (along ? 2 : 0.95), x + (along ? 2 : 0.95), z - (along ? 0.95 : 2), z + (along ? 0.95 : 2), true);
    }
  }

  hd?.finish(g);
  const mesh = m.mesh();
  g.add(mesh);
  // Luz de las farolas
  const lampMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const [x, z] of lamps) {
    const s = new THREE.Sprite(lampMat);
    s.position.set(x, R + 4.2, z);
    s.scale.setScalar(opts.night ? 2.6 : 1.8);
    g.add(s);
  }
  sc.add(g);
  return { group: g, lamps };
}
