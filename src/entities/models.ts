import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Personajes y decorado hechos con primitivas low-poly: no hay que descargar modelos
// y el juego entero cabe en un único archivo.

const matCache = new Map<number, THREE.MeshLambertMaterial>();
export function mat(color: number) {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, m);
  }
  return m;
}
export const vertexMat = new THREE.MeshLambertMaterial({ vertexColors: true });

/** Junta muchas piezas de colores en una sola geometría (1 draw call). */
export class Merger {
  private parts: THREE.BufferGeometry[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private c = new THREE.Color();

  add(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()) as THREE.BufferGeometry;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    this.q.setFromEuler(this.e.set(rx, ry, rz));
    this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(this.m);
    this.c.set(color);
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      cols[i * 3] = this.c.r;
      cols[i * 3 + 1] = this.c.g;
      cols[i * 3 + 2] = this.c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.parts.push(g);
    return this;
  }

  build() {
    const g = mergeGeometries(this.parts)!;
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    return g;
  }

  mesh() {
    return new THREE.Mesh(this.build(), vertexMat);
  }
}

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 4),
  sphere: new THREE.SphereGeometry(0.5, 9, 6),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 2, 8),
};

// Sombra difuminada barata en vez de shadow maps.
let shadowTex: THREE.Texture | null = null;
function getShadowTex() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.45)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
let shadowMat: THREE.MeshBasicMaterial | null = null;
export function blobShadow(size: number) {
  shadowMat ??= new THREE.MeshBasicMaterial({ map: getShadowTex(), transparent: true, depthWrite: false });
  const m = new THREE.Mesh(shadowGeo, shadowMat);
  m.scale.set(size, 1, size);
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

export interface PersonLook {
  skin: number;
  shirt: number;
  pants: number;
  hair: number;
  hairStyle: 'long' | 'short' | 'bun' | 'cap';
  skirt?: boolean;
  eyes?: number;
}

export interface Person {
  root: THREE.Group;
  body: THREE.Group; // rebota/baila
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
}

function hairInto(m: Merger, look: PersonLook, y: number) {
  m.add(G.sphere, look.hair, 0, y + 0.08, -0.02, 0, 0, 0, 0.52, 0.42, 0.52);
  if (look.hairStyle === 'long') m.add(G.box, look.hair, 0, y - 0.18, -0.16, 0, 0, 0, 0.46, 0.55, 0.18);
  if (look.hairStyle === 'bun') m.add(G.sphere, look.hair, 0, y + 0.3, -0.14, 0, 0, 0, 0.24, 0.24, 0.24);
  if (look.hairStyle === 'cap') m.add(G.box, look.hair, 0, y + 0.06, 0.16, 0, 0, 0, 0.5, 0.06, 0.3);
}

/** Personaje animable (piernas y brazos separados). Mira hacia +Z. */
export function makePerson(look: PersonLook, scale = 1): Person {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const torso = new Merger();
  if (look.skirt) torso.add(new THREE.CylinderGeometry(0.22, 0.36, 0.45, 10), look.pants, 0, 0.78, 0);
  torso.add(G.capsule, look.shirt, 0, 1.12, 0, 0, 0, 0, 0.5, 0.42, 0.34);
  torso.add(G.sphere, look.skin, 0, 1.62, 0, 0, 0, 0, 0.44, 0.48, 0.44);
  torso.add(G.sphere, look.eyes ?? 0x222222, -0.08, 1.65, 0.2, 0, 0, 0, 0.06, 0.08, 0.04);
  torso.add(G.sphere, look.eyes ?? 0x222222, 0.08, 1.65, 0.2, 0, 0, 0, 0.06, 0.08, 0.04);
  torso.add(G.sphere, 0xe58a8a, 0, 1.55, 0.21, 0, 0, 0, 0.1, 0.03, 0.03);
  hairInto(torso, look, 1.66);
  body.add(torso.mesh());

  const limb = (color: number, len: number, w: number) => {
    const pivot = new THREE.Group();
    const m = new Merger().add(G.capsule, color, 0, -len / 2, 0, 0, 0, 0, w, len / 2, w).mesh();
    pivot.add(m);
    return pivot;
  };
  const legL = limb(look.pants, 0.62, 0.17);
  const legR = limb(look.pants, 0.62, 0.17);
  legL.position.set(-0.11, 0.78, 0);
  legR.position.set(0.11, 0.78, 0);
  const armL = limb(look.shirt, 0.5, 0.13);
  const armR = limb(look.shirt, 0.5, 0.13);
  armL.position.set(-0.3, 1.32, 0);
  armR.position.set(0.3, 1.32, 0);
  body.add(legL, legR, armL, armR);

  root.add(blobShadow(1.1));
  root.scale.setScalar(scale);
  return { root, body, legL, legR, armL, armR };
}

/** Geometría estática de una persona para la multitud (InstancedMesh). */
export function personGeometry(look: PersonLook, armsUp = false) {
  const m = new Merger();
  if (look.skirt) m.add(new THREE.CylinderGeometry(0.22, 0.36, 0.45, 8), look.pants, 0, 0.78, 0);
  m.add(G.capsule, look.shirt, 0, 1.12, 0, 0, 0, 0, 0.5, 0.42, 0.34);
  m.add(G.sphere, look.skin, 0, 1.62, 0, 0, 0, 0, 0.44, 0.48, 0.44);
  hairInto(m, look, 1.66);
  m.add(G.capsule, look.pants, -0.11, 0.47, 0, 0, 0, 0, 0.17, 0.31, 0.17);
  m.add(G.capsule, look.pants, 0.11, 0.47, 0, 0, 0, 0, 0.17, 0.31, 0.17);
  const a = armsUp ? 2.6 : 0.2;
  m.add(G.capsule, look.shirt, -0.36, armsUp ? 1.55 : 1.1, 0, 0, 0, -a, 0.13, 0.25, 0.13);
  m.add(G.capsule, look.shirt, 0.36, armsUp ? 1.55 : 1.1, 0, 0, 0, a, 0.13, 0.25, 0.13);
  m.add(G.cyl, 0x9c8668, 0, 0.02, 0, 0, 0, 0, 0.8, 0.01, 0.8); // sombra simple
  return m.build();
}

export interface Donkey {
  root: THREE.Group;
  pivot: THREE.Group; // gira hacia atrás al encabritarse
  legs: THREE.Object3D[]; // delantera izq, delantera der, trasera izq, trasera der
  head: THREE.Object3D;
}

/** Ase con su jinete (caixer): frac negro, pantalón blanco y bombín. Mira hacia +Z. */
export function makeDonkey(coat = 0x7d6b5d): Donkey {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.z = -0.75; // eje en las patas traseras
  root.add(pivot);
  const inner = new THREE.Group();
  inner.position.z = 0.75;
  pivot.add(inner);

  const b = new Merger();
  b.add(G.capsule, coat, 0, 1.15, 0, Math.PI / 2, 0, 0, 0.72, 0.65, 0.7);
  b.add(G.box, 0xd9cbbd, 0, 0.95, 0, 0, 0, 0, 0.5, 0.2, 1.2); // barriga clara
  b.add(G.box, 0x9b2335, 0, 1.52, -0.05, 0, 0, 0, 0.78, 0.08, 0.7); // manta roja
  b.add(G.cyl, 0x3a2e26, 0, 1.2, -0.95, -0.6, 0, 0, 0.08, 0.6, 0.08); // cola
  // Jinete
  b.add(G.capsule, 0xf3f0ea, -0.28, 1.45, 0.05, 0.3, 0, 0, 0.18, 0.35, 0.18);
  b.add(G.capsule, 0xf3f0ea, 0.28, 1.45, 0.05, 0.3, 0, 0, 0.18, 0.35, 0.18);
  b.add(G.capsule, 0x1b1b22, 0, 2.0, 0, 0, 0, 0, 0.42, 0.4, 0.3); // frac
  b.add(G.box, 0xffffff, 0, 2.05, 0.14, 0, 0, 0, 0.16, 0.3, 0.04); // camisa
  b.add(G.sphere, 0xe8b894, 0, 2.48, 0, 0, 0, 0, 0.36, 0.4, 0.36);
  b.add(G.cyl, 0x111111, 0, 2.72, 0, 0, 0, 0, 0.32, 0.22, 0.32); // bombín
  b.add(G.cyl, 0x111111, 0, 2.63, 0, 0, 0, 0, 0.5, 0.03, 0.5);
  b.add(G.capsule, 0x1b1b22, -0.25, 2.05, 0.25, 1.1, 0, 0, 0.11, 0.2, 0.11);
  b.add(G.capsule, 0x1b1b22, 0.25, 2.05, 0.25, 1.1, 0, 0, 0.11, 0.2, 0.11);
  inner.add(b.mesh());

  const head = new THREE.Group();
  head.position.set(0, 1.45, 0.75);
  const h = new Merger();
  h.add(G.capsule, coat, 0, 0.25, 0.1, 0.5, 0, 0, 0.3, 0.32, 0.3); // cuello
  h.add(G.box, coat, 0, 0.55, 0.4, 0.35, 0, 0, 0.3, 0.3, 0.65);
  h.add(G.box, 0xd9cbbd, 0, 0.45, 0.72, 0.35, 0, 0, 0.26, 0.24, 0.12); // hocico
  h.add(G.box, coat, -0.1, 0.95, 0.15, -0.25, 0, -0.25, 0.08, 0.5, 0.14); // orejas largas
  h.add(G.box, coat, 0.1, 0.95, 0.15, -0.25, 0, 0.25, 0.08, 0.5, 0.14);
  h.add(G.box, 0x111111, -0.16, 0.65, 0.5, 0, 0, 0, 0.03, 0.06, 0.06);
  h.add(G.box, 0x111111, 0.16, 0.65, 0.5, 0, 0, 0, 0.03, 0.06, 0.06);
  head.add(h.mesh());
  inner.add(head);

  const legs: THREE.Object3D[] = [];
  const legGeo = new Merger()
    .add(G.cyl, coat, 0, -0.4, 0, 0, 0, 0, 0.14, 0.8, 0.14)
    .add(G.cyl, 0x2a2420, 0, -0.82, 0, 0, 0, 0, 0.16, 0.08, 0.16)
    .build();
  for (const [x, z] of [[-0.22, 0.55], [0.22, 0.55], [-0.22, -0.55], [0.22, -0.55]]) {
    const p = new THREE.Group();
    p.position.set(x, 0.86, z);
    p.add(new THREE.Mesh(legGeo, vertexMat));
    inner.add(p);
    legs.push(p);
  }
  root.add(blobShadow(2.2));
  return { root, pivot, legs, head };
}

export interface Dog {
  root: THREE.Group;
  tail: THREE.Object3D;
  legs: THREE.Object3D[];
}

/** Joy: perra negra mediana. Mira hacia +Z. */
export function makeDog(): Dog {
  const root = new THREE.Group();
  const black = 0x1d1b1f;
  const b = new Merger();
  b.add(G.capsule, black, 0, 0.5, 0, Math.PI / 2, 0, 0, 0.36, 0.38, 0.34);
  b.add(G.sphere, black, 0, 0.78, 0.42, 0, 0, 0, 0.36, 0.34, 0.36); // cabeza
  b.add(G.box, black, 0, 0.72, 0.62, 0, 0, 0, 0.18, 0.15, 0.22); // hocico
  b.add(G.sphere, 0x050505, 0, 0.75, 0.74, 0, 0, 0, 0.07, 0.06, 0.06);
  b.add(G.box, black, -0.14, 0.9, 0.38, 0, 0, 0.5, 0.08, 0.22, 0.16); // orejas caídas
  b.add(G.box, black, 0.14, 0.9, 0.38, 0, 0, -0.5, 0.08, 0.22, 0.16);
  b.add(G.sphere, 0xffffff, -0.09, 0.84, 0.58, 0, 0, 0, 0.06, 0.06, 0.04);
  b.add(G.sphere, 0xffffff, 0.09, 0.84, 0.58, 0, 0, 0, 0.06, 0.06, 0.04);
  b.add(G.box, 0xd7263d, 0, 0.66, 0.3, 0, 0, 0, 0.3, 0.06, 0.12); // collar
  b.add(G.box, 0xff7aa2, 0, 0.6, 0.66, 0.3, 0, 0, 0.06, 0.02, 0.1); // lengua
  root.add(b.mesh());
  const tail = new THREE.Group();
  tail.position.set(0, 0.6, -0.36);
  tail.add(new Merger().add(G.capsule, black, 0, 0.15, -0.05, -0.5, 0, 0, 0.06, 0.15, 0.06).mesh());
  root.add(tail);
  const legGeo = new Merger().add(G.capsule, black, 0, -0.16, 0, 0, 0, 0, 0.09, 0.2, 0.09).build();
  const legs: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.12, 0.22], [0.12, 0.22], [-0.12, -0.22], [0.12, -0.22]]) {
    const p = new THREE.Group();
    p.position.set(x, 0.36, z);
    p.add(new THREE.Mesh(legGeo, vertexMat));
    root.add(p);
    legs.push(p);
  }
  root.add(blobShadow(0.9));
  return { root, tail, legs };
}

/** Coche del viaje con Azul, Gas y Joy asomada por la ventanilla. Mira hacia +Z. */
export function makeCar(color = 0xd7263d) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const m = new Merger();
  m.add(G.box, color, 0, 0.62, 0, 0, 0, 0, 1.8, 0.6, 3.8);
  m.add(G.box, color, 0, 1.15, -0.25, 0, 0, 0, 1.6, 0.55, 2.1);
  m.add(G.box, 0x9fd3e8, 0, 1.15, 0.82, -0.35, 0, 0, 1.5, 0.45, 0.06); // parabrisas
  m.add(G.box, 0x9fd3e8, 0, 1.15, -1.31, 0.3, 0, 0, 1.5, 0.4, 0.06);
  m.add(G.box, 0x9fd3e8, -0.81, 1.17, -0.25, 0, 0, 0, 0.04, 0.38, 1.8);
  m.add(G.box, 0x9fd3e8, 0.81, 1.17, -0.25, 0, 0, 0, 0.04, 0.38, 1.8);
  m.add(G.box, 0xfff3b0, -0.6, 0.7, 1.91, 0, 0, 0, 0.35, 0.18, 0.04); // faros
  m.add(G.box, 0xfff3b0, 0.6, 0.7, 1.91, 0, 0, 0, 0.35, 0.18, 0.04);
  m.add(G.box, 0xff3030, -0.65, 0.72, -1.91, 0, 0, 0, 0.3, 0.14, 0.04);
  m.add(G.box, 0xff3030, 0.65, 0.72, -1.91, 0, 0, 0, 0.3, 0.14, 0.04);
  m.add(G.box, 0x333333, 0, 0.42, 1.92, 0, 0, 0, 1.7, 0.18, 0.06);
  m.add(G.box, 0x333333, 0, 0.42, -1.92, 0, 0, 0, 1.7, 0.18, 0.06);
  // Equipaje en la baca
  m.add(G.box, 0x6b4428, 0, 1.55, -0.4, 0, 0, 0, 1.1, 0.25, 1.2);
  m.add(G.box, 0x2f6b46, 0.1, 1.78, -0.3, 0, 0.2, 0, 0.7, 0.22, 0.6);
  // Azul (rubia) conduce a la izquierda, Gas de copiloto
  m.add(G.sphere, 0xf4d0b0, -0.4, 1.25, 0.2, 0, 0, 0, 0.32, 0.36, 0.32);
  m.add(G.sphere, 0xf2d27a, -0.4, 1.33, 0.17, 0, 0, 0, 0.36, 0.3, 0.36);
  m.add(G.sphere, 0xe8b894, 0.4, 1.25, 0.2, 0, 0, 0, 0.32, 0.36, 0.32);
  m.add(G.sphere, 0x2b1d14, 0.4, 1.36, 0.17, 0, 0, 0, 0.34, 0.22, 0.34);
  body.add(m.mesh());
  // Joy asomada por la ventanilla trasera
  const joy = new THREE.Group();
  joy.position.set(0.82, 1.18, -0.9);
  const j = new Merger();
  j.add(G.sphere, 0x1d1b1f, 0, 0, 0, 0, 0, 0, 0.36, 0.32, 0.36);
  j.add(G.box, 0x1d1b1f, 0.08, -0.04, 0.2, 0, 0, 0, 0.16, 0.14, 0.2);
  j.add(G.box, 0x1d1b1f, 0, 0.14, -0.15, 0.9, 0, 0, 0.1, 0.24, 0.12); // oreja al viento
  j.add(G.box, 0xff7aa2, 0.08, -0.12, 0.26, 0.4, 0, 0, 0.06, 0.02, 0.12);
  joy.add(j.mesh());
  body.add(joy);
  const wheels: THREE.Object3D[] = [];
  const wGeo = new Merger().add(G.cyl, 0x1a1a1a, 0, 0, 0, 0, 0, Math.PI / 2, 0.68, 0.32, 0.68).add(G.cyl, 0xbbbbbb, 0, 0, 0, 0, 0, Math.PI / 2, 0.34, 0.34, 0.34).build();
  for (const [x, z] of [[-0.85, 1.25], [0.85, 1.25], [-0.85, -1.25], [0.85, -1.25]]) {
    const w = new THREE.Mesh(wGeo, vertexMat);
    w.position.set(x, 0.34, z);
    root.add(w);
    wheels.push(w);
  }
  root.add(blobShadow(4));
  return { root, body, joy, wheels };
}

/** Zamburiña en su concha. Devuelve la concha y la carne (cuyo color cambia al cocinarse). */
export function makeScallop() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.25, 1).rotateX(Math.PI), mat(0xe9b9a0));
  shell.position.y = 0.13;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.05, 4, 16).rotateX(Math.PI / 2), mat(0xd98f73));
  rim.position.y = 0.13;
  const meat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0xf3e6d3 }));
  meat.position.y = 0.16;
  g.add(shell, rim, meat);
  return { root: g, meat };
}
