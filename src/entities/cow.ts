import * as THREE from 'three';
import { G, Merger } from './models';

// Vacas de verdad para el capítulo de la carretera: cuerpo redondeado por volúmenes (pecho, barriga,
// grupa), manchas, cuello, cabeza con morro, ollares, orejas y cuernos cortos, ubre, patas con pezuña y
// cola con su borla. La misma vaca sirve quieta en los prados y, por piezas, en mitad de la carretera.

export type CowCoat = 'frisona' | 'tudanca';
const COATS: Record<CowCoat, { base: number; spot: number; muzzle: number }> = {
  frisona: { base: 0xf1ede3, spot: 0x25211e, muzzle: 0xdca0a0 },
  tudanca: { base: 0x8d7360, spot: 0x5a4436, muzzle: 0x2f2925 },
};

function bodyInto(m: Merger, c: (typeof COATS)[CowCoat]) {
  // Barriga, pecho, grupa y cruz
  m.add(G.sphere, c.base, 0, 1.0, 0, 0, 0, 0, 1.0, 1.0, 1.9);
  m.add(G.sphere, c.base, 0, 1.08, 0.66, 0, 0, 0, 0.92, 0.96, 0.95);
  m.add(G.sphere, c.base, 0, 1.1, -0.66, 0, 0, 0, 0.96, 0.92, 0.95);
  m.add(G.sphere, c.base, 0, 1.32, 0.78, 0, 0, 0, 0.5, 0.42, 0.6);
  // Manchas: un poco más grandes que el cuerpo, asoman como pelaje de otro color
  m.add(G.sphere, c.spot, 0.3, 1.2, 0.38, 0.2, 0.3, 0, 0.56, 0.68, 0.96);
  m.add(G.sphere, c.spot, -0.33, 1.08, -0.3, -0.1, -0.2, 0, 0.5, 0.72, 0.86);
  m.add(G.sphere, c.spot, 0.12, 1.34, -0.82, 0.1, 0, 0, 0.72, 0.5, 0.62);
  m.add(G.sphere, c.spot, -0.2, 1.36, 0.95, 0, 0, 0, 0.42, 0.34, 0.42);
  // Ubre
  m.add(G.sphere, 0xe6b0ac, 0, 0.56, -0.56, 0, 0, 0, 0.42, 0.3, 0.46);
  for (const [x, z] of [[-0.09, -0.46], [0.09, -0.46], [-0.09, -0.66], [0.09, -0.66]]) m.add(G.cyl, 0xd99a96, x, 0.4, z, 0, 0, 0, 0.035, 0.09, 0.035);
  // Cuello
  m.add(G.capsule, c.base, 0, 1.3, 1.08, 0.9, 0, 0, 0.42, 0.36, 0.46);
}

function headInto(m: Merger, c: (typeof COATS)[CowCoat], x = 0, y = 0, z = 0) {
  m.add(G.sphere, c.base, x, y, z, 0, 0, 0, 0.42, 0.44, 0.56);
  m.add(G.sphere, c.spot, x, y + 0.13, z + 0.02, 0, 0, 0, 0.4, 0.26, 0.42); // frente oscura
  m.add(G.sphere, c.muzzle, x, y - 0.1, z + 0.28, 0, 0, 0, 0.34, 0.26, 0.26); // morro
  for (const s of [-1, 1]) {
    m.add(G.sphere, 0x241c1a, x + s * 0.07, y - 0.08, z + 0.4, 0, 0, 0, 0.05, 0.05, 0.03); // ollar
    m.add(G.sphere, 0x14100e, x + s * 0.19, y + 0.05, z + 0.17, 0, 0, 0, 0.08, 0.09, 0.08); // ojo
    m.add(G.sphere, c.base, x + s * 0.32, y + 0.12, z - 0.07, 0, 0, s * 0.3, 0.26, 0.1, 0.15); // oreja
    m.add(G.cone, 0xd9cdb0, x + s * 0.17, y + 0.26, z - 0.1, 0, 0, -s * 0.6, 0.06, 0.2, 0.06); // cuerno
  }
}

function legInto(m: Merger, c: (typeof COATS)[CowCoat], x: number, z: number, y0 = 0) {
  m.add(G.capsule, c.base, x, y0 + 0.66, z, 0, 0, 0, 0.2, 0.34, 0.24);
  m.add(G.cyl, c.base, x, y0 + 0.28, z, 0, 0, 0, 0.12, 0.42, 0.13);
  m.add(G.cyl, 0x1e1a18, x, y0 + 0.05, z, 0, 0, 0, 0.15, 0.1, 0.17); // pezuña
}

const LEGS: [number, number][] = [[-0.28, 0.62], [0.28, 0.62], [-0.28, -0.68], [0.28, -0.68]];

/** Una sola geometría, para las vacas quietas de los prados (instanciadas). */
export function cowGeometry(coat: CowCoat = 'frisona') {
  const c = COATS[coat];
  const m = new Merger();
  bodyInto(m, c);
  headInto(m, c, 0, 1.42, 1.42);
  for (const [x, z] of LEGS) legInto(m, c, x, z);
  m.add(G.cyl, c.base, 0, 0.92, -1.05, -0.12, 0, 0, 0.05, 0.85, 0.05);
  m.add(G.sphere, c.spot, 0, 0.45, -1.1, 0, 0, 0, 0.13, 0.3, 0.13);
  return m.build();
}

export interface RoadCow {
  root: THREE.Group;
  /** Mueve la cabeza, la cola y, si `walk` > 0, las patas. */
  update(t: number, walk: number): void;
}

/** La vaca de la carretera, por piezas: gira la cabeza, mueve la cola y camina. */
export function makeRoadCow(coat: CowCoat = 'frisona'): RoadCow {
  const c = COATS[coat];
  const root = new THREE.Group();
  const bm = new Merger();
  bodyInto(bm, c);
  const body = bm.mesh();
  body.castShadow = true;
  root.add(body);
  const head = new THREE.Group();
  head.position.set(0, 1.42, 1.3);
  const hm = new Merger();
  headInto(hm, c, 0, 0, 0.12);
  const hmesh = hm.mesh();
  hmesh.castShadow = true;
  head.add(hmesh);
  root.add(head);
  const legs = LEGS.map(([x, z]) => {
    const g = new THREE.Group();
    g.position.set(x, 0.86, z);
    const m = new Merger();
    legInto(m, c, 0, 0, -0.86);
    const lm = m.mesh();
    lm.castShadow = true;
    g.add(lm);
    root.add(g);
    return g;
  });
  const tail = new THREE.Group();
  tail.position.set(0, 1.36, -1.08);
  {
    const m = new Merger();
    m.add(G.cyl, c.base, 0, -0.42, 0, 0, 0, 0, 0.05, 0.85, 0.05);
    m.add(G.sphere, c.spot, 0, -0.9, 0, 0, 0, 0, 0.13, 0.3, 0.13);
    tail.add(m.mesh());
  }
  root.add(tail);
  return {
    root,
    update(t, walk) {
      head.rotation.y = walk > 0 ? 0 : -0.75 + Math.sin(t * 0.7) * 0.18; // mira al coche
      head.rotation.x = Math.sin(t * 1.1) * 0.06 + (walk > 0 ? Math.sin(t * 5) * 0.05 : 0);
      tail.rotation.z = Math.sin(t * 2.4) * 0.35;
      tail.rotation.x = 0.12 + Math.sin(t * 1.7) * 0.08;
      const w = Math.sin(t * 6) * 0.4 * walk;
      legs[0].rotation.x = legs[3].rotation.x = w;
      legs[1].rotation.x = legs[2].rotation.x = -w;
    },
  };
}
