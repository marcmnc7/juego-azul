import * as THREE from 'three';
import { G, Merger } from '../entities/models';
import { glowTexture } from '../core/gfx';
import { ROOF_GEO, rand, type Box2 } from './ferreries';

// Alrededores: que ningún nivel acabe en un suelo infinito y un horizonte vacío. Rellena todo lo que
// rodea la zona jugable con urbanización menorquina (casas encaladas de teja, muros de jardín, pinos,
// palmeras y acebuches), un suelo de campo con textura hasta lejos y, al fondo, lomas bajas que cierran
// el horizonte. Todo en una sola malla.

export interface SurroundOpts {
  /** Zonas donde no se pone nada (lo que ya está construido), en coordenadas del mundo. */
  keepOut: Box2[];
  /** Mitad del lado del cuadrado que se rellena, alrededor de `center`. */
  half: number;
  center?: { x: number; z: number };
  /** Cuadrícula de parcelas (m). */
  cell?: number;
  night?: boolean;
  seed?: number;
  /** Lado donde no hay casas (mar): 'n' = +z, 's' = -z, 'e' = +x, 'w' = -x. */
  sea?: ('n' | 's' | 'e' | 'w')[];
  /** Si se pasa, cada parcela y cada árbol suelto es un obstáculo (nada se atraviesa). */
  colliders?: Box2[];
  /** Pueblo: manzanas de casas de dos plantas pegadas, sin jardín. */
  town?: boolean;
  /** Agua (mar): ahí no se pone nada. */
  water?: (x: number, z: number) => boolean;
  /** Si no, deja solo el campo y las lomas. */
  houses?: boolean;
  groundY?: number;
  /** Suelo de campo bajo todo (no donde hay mar por debajo de 0). */
  field?: boolean;
  /** Hueco en el suelo de campo (p. ej. una piscina por debajo de 0). */
  hole?: Box2;
}

const WALLS = [0xfbf7ee, 0xf6f0e3, 0xf3ead8, 0xf1d9a0, 0xfdfaf3];
const ROOFS = [0xb8623e, 0xc0653d, 0xb5603b];
const SHUT = [0x2f6b46, 0x2f6b46, 0x24603a, 0x2b5f8a];

export function buildSurroundings(sc: THREE.Scene, o: SurroundOpts) {
  const r = rand(o.seed ?? 7);
  const cx = o.center?.x ?? 0;
  const cz = o.center?.z ?? 0;
  const H = o.half;
  const cell = o.cell ?? 13;
  const y0 = o.groundY ?? 0;
  const m = new Merger();
  const free = (x0: number, x1: number, z0: number, z1: number) =>
    !o.keepOut.some((k) => x1 > k.minX - 1 && x0 < k.maxX + 1 && z1 > k.minZ - 1 && z0 < k.maxZ + 1);
  const seaSide = (x: number, z: number) =>
    !!o.water?.(x, z) ||
    (o.sea ?? []).some((s) => (s === 'n' ? z > cz + H * 0.15 : s === 's' ? z < cz - H * 0.15 : s === 'e' ? x > cx + H * 0.15 : x < cx - H * 0.15));

  // Suelo de campo hasta lejos (debajo de todo lo demás)
  if (o.field !== false) {
    const F = H + 130;
    const rect = (x0: number, x1: number, z0: number, z1: number) => {
      if (x1 > x0 && z1 > z0) m.add(G.box, 0x5f6f3c, (x0 + x1) / 2, y0 - 0.12, (z0 + z1) / 2, 0, 0, 0, x1 - x0, 0.1, z1 - z0);
    };
    const h = o.hole;
    if (!h) rect(cx - F, cx + F, cz - F, cz + F);
    else {
      rect(cx - F, cx + F, cz - F, h.minZ);
      rect(cx - F, cx + F, h.maxZ, cz + F);
      rect(cx - F, h.minX, h.minZ, h.maxZ);
      rect(h.maxX, cx + F, h.minZ, h.maxZ);
    }
  }
  const lights: number[] = [];
  const tree = (x: number, z: number, kind: number) => {
    if (kind === 0) {
      // Pino
      const h = 5 + r() * 4;
      m.add(G.cyl, 0x6b5a40, x, y0 + h / 2, z, 0, 0, 0.05, 0.35, h, 0.35);
      for (let k = 0; k < 3; k++) m.add(G.bush, k % 2 ? 0x2f5a2c : 0x386a32, x + (r() - 0.5) * 1.6, y0 + h + 0.2 + k * 0.4, z + (r() - 0.5) * 1.6, 0, r() * 6, 0, 3.6 - k * 0.6, 1.3, 3.2 - k * 0.5);
    } else if (kind === 1) {
      // Palmera
      const h = 5 + r() * 3;
      m.add(G.cyl, 0x6b5a40, x, y0 + h / 2, z, 0, 0, 0.04, 0.4, h, 0.4);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        m.add(G.box, 0x2f6a34, x + Math.cos(a) * 1.3, y0 + h + 0.1, z + Math.sin(a) * 1.3, 0, -a, 0.5, 2.7, 0.08, 0.6);
      }
    } else {
      // Acebuche
      m.add(G.cyl, 0x5a4a38, x, y0 + 0.9, z, 0, 0, 0.1, 0.3, 1.8, 0.3);
      m.add(G.bush, 0x5a7044, x, y0 + 2.2, z, 0, r() * 6, 0, 2.8, 1.8, 2.6);
    }
  };

  if (o.houses !== false) {
    for (let x = cx - H; x < cx + H; x += cell)
      for (let z = cz - H; z < cz + H; z += cell) {
        const px = x + cell / 2 + (r() - 0.5) * 2;
        const pz = z + cell / 2 + (r() - 0.5) * 2;
        if (!free(x, x + cell, z, z + cell)) continue;
        if (seaSide(px, pz)) {
          if (r() < 0.25) m.add(G.rock2, 0x8a7a62, px, y0 - 0.3, pz, 0, r() * 6, 0, 2 + r() * 2, 0.8, 2 + r() * 2);
          continue;
        }
        if (!o.town && r() < 0.12) {
          // Solar con árboles
          tree(px, pz, Math.floor(r() * 3));
          tree(px + 3, pz - 2, 0);
          o.colliders?.push({ minX: px - 0.5, maxX: px + 0.5, minZ: pz - 0.5, maxZ: pz + 0.5 }, { minX: px + 2.5, maxX: px + 3.5, minZ: pz - 2.5, maxZ: pz - 1.5 });
          continue;
        }
        const w = o.town ? cell - 0.4 : 6.5 + r() * 2.5;
        const d = o.town ? cell - 0.4 : 6 + r() * 2.5;
        const h = o.town ? 6 + r() * 2.5 : r() < 0.4 ? 5.8 : 3.2;
        const wall = WALLS[Math.floor(r() * WALLS.length)];
        const ry = r() < 0.5 ? 0 : Math.PI / 2;
        m.add(G.box, wall, px, y0 + h / 2, pz, 0, ry, 0, w, h, d);
        // (cada tejado con su propia pendiente: dos vecinos que se solapan no quedan en el mismo plano)
        if (o.town || r() < 0.65) m.add(ROOF_GEO, ROOFS[Math.floor(r() * ROOFS.length)], px, y0 + h, pz, 0, ry, 0, w + 0.6, 1.6 + (Math.abs(Math.round(px * 3 + pz * 7)) % 5) * 0.06, d + 0.6);
        else {
          // Azotea con pretil
          m.add(G.box, wall, px, y0 + h + 0.3, pz, 0, ry, 0, w + 0.2, 0.6, d + 0.2);
          m.add(G.box, 0xd9d2c2, px, y0 + h + 0.05, pz, 0, ry, 0, w - 0.3, 0.1, d - 0.3);
        }
        // Ventanas con persianas en las cuatro caras (luz en algunas, de noche)
        const sh = SHUT[Math.floor(r() * SHUT.length)];
        const along = (s: number, onX: boolean) => {
          const len = onX ? (ry ? d : w) : ry ? w : d;
          const half = (onX ? (ry ? w : d) : ry ? d : w) / 2 + 0.03;
          for (const a of [-len / 4, len / 4]) {
            const lit = o.night && r() < 0.3;
            const wx = onX ? px + a : px + s * half;
            const wz = onX ? pz + s * half : pz + a;
            const wy = y0 + Math.min(h - 1.2, 1.7);
            m.add(G.box, lit ? 0xffd9a0 : sh, wx, wy, wz, 0, 0, 0, onX ? 1.0 : 0.06, 1.2, onX ? 0.06 : 1.0);
            if (lit) lights.push(wx, wy, wz);
          }
        };
        along(1, true);
        along(-1, true);
        along(1, false);
        along(-1, false);
        if (o.town) {
          o.colliders?.push({ minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2 });
          continue;
        }
        // Muro bajo del jardín y un árbol
        const gw = cell - 1;
        o.colliders?.push({ minX: px - gw / 2 - 0.15, maxX: px + gw / 2 + 0.15, minZ: pz - gw / 2 - 0.15, maxZ: pz + gw / 2 + 0.15 });
        for (const s of [-1, 1]) {
          m.add(G.box, 0xf4efe2, px, y0 + 0.6, pz + s * gw / 2, 0, 0, 0, gw, 1.2, 0.25);
          m.add(G.box, 0xf4efe2, px + s * gw / 2, y0 + 0.6, pz, 0, 0, 0, 0.25, 1.2, gw);
        }
        if (r() < 0.7) tree(px + (r() < 0.5 ? -1 : 1) * (gw / 2 - 1.5), pz + (r() - 0.5) * (gw - 3), Math.floor(r() * 3));
      }
  }

  // Lomas bajas al fondo: cierran el horizonte (nada de suelo que se pierde en el vacío)
  const R0 = H + 70;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + r() * 0.1;
    const x = cx + Math.cos(a) * (R0 + r() * 40);
    const z = cz + Math.sin(a) * (R0 + r() * 40);
    if (seaSide(x, z)) continue;
    m.add(G.sphere, i % 2 ? 0x4c5e34 : 0x56683a, x, y0 - 6, z, 0, a, 0, 70 + r() * 50, 22 + r() * 16, 40 + r() * 20);
  }
  const mesh = m.mesh();
  mesh.userData.noCast = true;
  sc.add(mesh);
  if (lights.length) {
    sc.add(
      new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lights, 3)),
        new THREE.PointsMaterial({ map: glowTexture(), color: 0xffd38a, size: 1.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      ),
    );
  }
  return mesh;
}

/** Caja que envuelve todos los obstáculos (lo ya construido), para no poner nada encima. */
export function collidersBox(cs: readonly Box2[], pad = 1): Box2 {
  const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const c of cs) {
    b.minX = Math.min(b.minX, c.minX - pad);
    b.maxX = Math.max(b.maxX, c.maxX + pad);
    b.minZ = Math.min(b.minZ, c.minZ - pad);
    b.maxZ = Math.max(b.maxZ, c.maxZ + pad);
  }
  return b;
}
