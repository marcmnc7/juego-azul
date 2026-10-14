import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, addOutline } from '../core/gfx';

// Personajes y decorado hechos con primitivas low-poly y sombreado "cel":
// no hay que descargar modelos y el juego entero cabe en un único archivo.

const matCache = new Map<number, THREE.MeshToonMaterial>();
export function mat(color: number) {
  let m = matCache.get(color);
  if (!m) {
    m = toon({ color });
    matCache.set(color, m);
  }
  return m;
}
export const vertexMat = toon({ vertexColors: true });

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

  get empty() {
    return this.parts.length === 0;
  }

  build() {
    const g = mergeGeometries(this.parts)!;
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    g.computeBoundingSphere();
    return g;
  }

  mesh() {
    return new THREE.Mesh(this.build(), vertexMat);
  }
}

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rbox: roundedBox(),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone: new THREE.ConeGeometry(0.5, 1, 4),
  sphere: new THREE.SphereGeometry(0.5, 12, 8),
  ball: new THREE.SphereGeometry(0.5, 18, 14),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 4, 10),
  dome: new THREE.SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
  smile: new THREE.TorusGeometry(0.5, 0.18, 4, 10, Math.PI),
};

// Versión de pocos polígonos para la multitud (cientos de personas)
const GL: typeof G = {
  ...G,
  sphere: new THREE.SphereGeometry(0.5, 7, 5),
  ball: new THREE.SphereGeometry(0.5, 9, 6),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 2, 6),
  dome: new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.56),
};


/** Caja con cantos biselados (cuesta poco y queda mucho más "juguete"). */
function roundedBox() {
  const g = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ax = Math.abs(v.x) > 0.49 ? 1 : 0;
    const ay = Math.abs(v.y) > 0.49 ? 1 : 0;
    const az = Math.abs(v.z) > 0.49 ? 1 : 0;
    if (ax + ay + az >= 2) v.multiplyScalar(0.9);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Sombra difuminada para cuando el móvil no puede con sombras reales.
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
  m.userData.blob = true;
  return m;
}

export interface PersonLook {
  skin: number;
  shirt: number;
  pants: number;
  hair: number;
  hairStyle: 'long' | 'short' | 'bun' | 'cap' | 'pony';
  skirt?: boolean;
  eyes?: number;
  shoes?: number;
  beard?: boolean;
}

export type PersonMode = 'idle' | 'walk' | 'dance' | 'wave' | 'cheer' | 'talk';

export interface Person {
  root: THREE.Group;
  body: THREE.Group; // rebota/baila
  head: THREE.Group;
  eyes: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  handR: THREE.Object3D; // para llevar cosas (una pomada)
  blink: number;
  t: number;
}

const HEAD_Y = 1.3; // base del cuello
const darker = (c: number, k = 0.75) => new THREE.Color(c).multiplyScalar(k).getHex();

/** Pelo. Coordenadas relativas al centro de la cabeza. */
function hairInto(m: Merger, look: PersonLook, oy = 0, oz = 0, g: typeof G = G) {
  const h = look.hair;
  if (look.hairStyle === 'cap') {
    m.add(g.dome, h, 0, oy + 0.04, oz - 0.01, -0.15, 0, 0, 0.66, 0.6, 0.66);
    m.add(g.cyl, h, 0, oy + 0.1, oz + 0.26, 0.12, 0, 0, 0.42, 0.04, 0.3); // visera
    return;
  }
  m.add(g.dome, h, 0, oy + 0.02, oz - 0.02, -0.28, 0, 0, 0.66, 0.66, 0.66);
  // Flequillo
  m.add(g.sphere, h, -0.13, oy + 0.2, oz + 0.2, 0, 0, 0.5, 0.22, 0.12, 0.12);
  m.add(g.sphere, h, 0.06, oy + 0.22, oz + 0.22, 0, 0, -0.3, 0.24, 0.12, 0.12);
  if (look.hairStyle === 'long') {
    m.add(g.capsule, h, 0, oy - 0.16, oz - 0.14, 0.12, 0, 0, 0.6, 0.32, 0.26);
    m.add(g.capsule, h, -0.27, oy - 0.12, oz + 0.02, 0, 0, 0.08, 0.13, 0.28, 0.16);
    m.add(g.capsule, h, 0.27, oy - 0.12, oz + 0.02, 0, 0, -0.08, 0.13, 0.28, 0.16);
  } else if (look.hairStyle === 'bun') {
    m.add(g.sphere, h, 0, oy + 0.3, oz - 0.16, 0, 0, 0, 0.28, 0.28, 0.28);
  } else if (look.hairStyle === 'pony') {
    m.add(g.capsule, h, 0, oy - 0.05, oz - 0.36, 0.5, 0, 0, 0.16, 0.24, 0.16);
  } else {
    m.add(g.sphere, h, 0, oy - 0.02, oz - 0.08, 0, 0, 0, 0.62, 0.5, 0.56);
  }
}

/** Cara: nariz, mejillas, boca, cejas y orejas (los ojos van aparte para parpadear). */
function faceInto(m: Merger, look: PersonLook, oy = 0) {
  m.add(G.sphere, darker(look.skin, 0.93), 0, oy - 0.03, 0.29, 0, 0, 0, 0.07, 0.06, 0.06); // nariz
  m.add(G.sphere, 0xf2a3a3, -0.17, oy - 0.07, 0.22, 0, 0, 0, 0.1, 0.06, 0.04);
  m.add(G.sphere, 0xf2a3a3, 0.17, oy - 0.07, 0.22, 0, 0, 0, 0.1, 0.06, 0.04);
  m.add(G.smile, 0x8a3040, 0, oy - 0.1, 0.265, Math.PI, 0, 0, 0.06, 0.06, 0.05); // sonrisa
  m.add(G.box, darker(look.hair, 0.6), -0.11, oy + 0.13, 0.27, 0, 0, 0.12, 0.1, 0.022, 0.02); // cejas
  m.add(G.box, darker(look.hair, 0.6), 0.11, oy + 0.13, 0.27, 0, 0, -0.12, 0.1, 0.022, 0.02);
  m.add(G.sphere, look.skin, -0.3, oy, 0, 0, 0, 0, 0.08, 0.12, 0.08); // orejas
  m.add(G.sphere, look.skin, 0.3, oy, 0, 0, 0, 0, 0.08, 0.12, 0.08);
  if (look.beard) m.add(G.sphere, darker(look.hair, 0.9), 0, oy - 0.15, 0.17, 0, 0, 0, 0.42, 0.22, 0.2);
}

function eyesInto(m: Merger, look: PersonLook, oy = 0) {
  for (const s of [-1, 1]) {
    m.add(G.sphere, 0xffffff, s * 0.11, oy, 0.255, 0, 0, 0, 0.11, 0.13, 0.05);
    m.add(G.sphere, look.eyes ?? 0x3a2a20, s * 0.11, oy - 0.005, 0.275, 0, 0, 0, 0.075, 0.095, 0.03);
    m.add(G.sphere, 0x111111, s * 0.11, oy - 0.005, 0.285, 0, 0, 0, 0.04, 0.05, 0.02);
    m.add(G.sphere, 0xffffff, s * 0.11 + 0.018, oy + 0.025, 0.295, 0, 0, 0, 0.022, 0.022, 0.01);
  }
}

/** Personaje animable con cabeza grande (estilo "chibi"). Mira hacia +Z. */
export function makePerson(look: PersonLook, scale = 1, outline = true): Person {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const shoes = look.shoes ?? 0x3a2a20;

  const torso = new Merger();
  if (look.skirt) torso.add(new THREE.CylinderGeometry(0.2, 0.42, 0.5, 14), look.pants, 0, 0.78, 0);
  torso.add(G.capsule, look.shirt, 0, 1.0, 0, 0, 0, 0, 0.46, 0.3, 0.32);
  torso.add(G.cyl, look.skin, 0, 1.26, 0, 0, 0, 0, 0.14, 0.12, 0.14);
  body.add(torso.mesh());

  const head = new THREE.Group();
  head.position.y = HEAD_Y;
  const hm = new Merger();
  hm.add(G.ball, look.skin, 0, 0.3, 0, 0, 0, 0, 0.6, 0.58, 0.56);
  faceInto(hm, look, 0.3);
  hairInto(hm, look, 0.3);
  head.add(hm.mesh());
  const eyes = new THREE.Group();
  eyes.position.y = 0.33;
  const em = new Merger();
  eyesInto(em, look, 0);
  const eyeMesh = em.mesh();
  eyeMesh.userData.noCast = true;
  eyes.add(eyeMesh);
  head.add(eyes);
  body.add(head);

  const leg = () => {
    const pivot = new THREE.Group();
    const m = new Merger()
      .add(G.capsule, look.skirt ? look.skin : look.pants, 0, -0.27, 0, 0, 0, 0, 0.15, 0.24, 0.15)
      .add(G.rbox, shoes, 0, -0.58, 0.04, 0, 0, 0, 0.17, 0.12, 0.28)
      .mesh();
    pivot.add(m);
    return pivot;
  };
  const arm = () => {
    const pivot = new THREE.Group();
    const m = new Merger()
      .add(G.capsule, look.shirt, 0, -0.17, 0, 0, 0, 0, 0.14, 0.18, 0.14)
      .add(G.capsule, look.skin, 0, -0.34, 0, 0, 0, 0, 0.1, 0.12, 0.1)
      .add(G.sphere, look.skin, 0, -0.47, 0.01, 0, 0, 0, 0.13, 0.14, 0.13)
      .mesh();
    pivot.add(m);
    return pivot;
  };
  const legL = leg();
  const legR = leg();
  legL.position.set(-0.11, 0.66, 0);
  legR.position.set(0.11, 0.66, 0);
  const armL = arm();
  const armR = arm();
  armL.position.set(-0.29, 1.17, 0);
  armR.position.set(0.29, 1.17, 0);
  const handR = new THREE.Object3D();
  handR.position.set(0, -0.48, 0.06);
  armR.add(handR);
  body.add(legL, legR, armL, armR);

  if (outline) addOutline(body, 0.02);
  root.add(blobShadow(1.1));
  root.scale.setScalar(scale);
  return { root, body, head, eyes, legL, legR, armL, armR, handR, blink: 2 + Math.random() * 3, t: Math.random() * 10 };
}

/** Anima un personaje: andar, bailar, saludar, celebrar, hablar o reposo (respira y parpadea). */
export function animatePerson(p: Person, dt: number, mode: PersonMode, move = 0, phase?: number) {
  p.t += dt;
  const t = phase ?? p.t;
  // Parpadeo
  p.blink -= dt;
  if (p.blink < 0) p.blink = 2.5 + Math.random() * 3;
  p.eyes.scale.y = p.blink < 0.12 ? 0.15 : 1;

  p.armL.rotation.set(0, 0, -0.12);
  p.armR.rotation.set(0, 0, 0.12);
  p.legL.rotation.set(0, 0, 0);
  p.legR.rotation.set(0, 0, 0);
  p.head.rotation.set(0, 0, 0);
  p.body.rotation.set(0, 0, 0);
  p.body.position.y = 0;

  switch (mode) {
    case 'walk': {
      const s = Math.sin(t);
      const k = Math.min(1, move);
      p.body.position.y = Math.abs(Math.cos(t)) * 0.07 * k;
      p.body.rotation.z = s * 0.04 * k;
      p.legL.rotation.x = s * 0.8 * k;
      p.legR.rotation.x = -s * 0.8 * k;
      p.armL.rotation.x = -s * 0.7 * k;
      p.armR.rotation.x = s * 0.7 * k;
      p.head.rotation.x = 0.05 * k;
      break;
    }
    case 'dance': {
      const s = Math.sin(t);
      p.body.position.y = Math.abs(Math.sin(t * 0.5)) * 0.25;
      p.body.rotation.y = Math.sin(t * 0.5) * 0.35;
      p.armL.rotation.z = -2.5 + s * 0.4;
      p.armR.rotation.z = 2.5 - s * 0.4;
      p.legL.rotation.x = Math.max(0, s) * 0.5;
      p.legR.rotation.x = Math.max(0, -s) * 0.5;
      p.head.rotation.z = s * 0.15;
      break;
    }
    case 'cheer': {
      p.body.position.y = Math.abs(Math.sin(t * 1.2)) * 0.18;
      p.armL.rotation.z = -2.8;
      p.armR.rotation.z = 2.8 + Math.sin(t * 3) * 0.2;
      break;
    }
    case 'wave': {
      p.armR.rotation.z = 2.6 + Math.sin(t * 7) * 0.35;
      p.head.rotation.z = Math.sin(t * 2) * 0.08;
      p.body.position.y = Math.sin(t * 2) * 0.01;
      break;
    }
    case 'talk': {
      p.head.rotation.x = Math.sin(t * 6) * 0.05;
      p.armR.rotation.x = -0.5 + Math.sin(t * 3) * 0.2;
      p.armR.rotation.z = 0.3;
      break;
    }
    default: {
      // Respiración
      p.body.position.y = Math.sin(t * 2) * 0.012;
      p.head.rotation.y = Math.sin(t * 0.5) * 0.15;
      p.armL.rotation.z = -0.12 - Math.sin(t * 2) * 0.02;
      p.armR.rotation.z = 0.12 + Math.sin(t * 2) * 0.02;
    }
  }
}

/** Geometría estática de una persona para la multitud (InstancedMesh). */
export function personGeometry(look: PersonLook, armsUp = false) {
  const m = new Merger();
  const shoes = look.shoes ?? 0x3a2a20;
  if (look.skirt) m.add(new THREE.CylinderGeometry(0.2, 0.42, 0.5, 7), look.pants, 0, 0.78, 0);
  m.add(GL.capsule, look.shirt, 0, 1.0, 0, 0, 0, 0, 0.46, 0.3, 0.32);
  const hy = HEAD_Y + 0.3;
  m.add(GL.sphere, look.skin, 0, hy, 0, 0, 0, 0, 0.6, 0.58, 0.56);
  hairInto(m, look, hy, 0, GL);
  for (const s of [-1, 1]) {
    m.add(GL.sphere, 0x2a2020, s * 0.11, hy + 0.03, 0.26, 0, 0, 0, 0.07, 0.1, 0.04);
    m.add(GL.sphere, 0xf2a3a3, s * 0.17, hy - 0.07, 0.22, 0, 0, 0, 0.1, 0.06, 0.04);
    m.add(GL.capsule, look.skirt ? look.skin : look.pants, s * 0.11, 0.4, 0, 0, 0, 0, 0.15, 0.24, 0.15);
    m.add(GL.box, shoes, s * 0.11, 0.08, 0.04, 0, 0, 0, 0.17, 0.12, 0.28);
    const a = armsUp ? 2.7 : 0.15;
    const sx = s * (0.29 + Math.sin(a) * 0.25);
    const sy = 1.17 - Math.cos(a) * 0.25;
    m.add(GL.capsule, look.shirt, sx, sy, 0, 0, 0, s * a, 0.13, 0.26, 0.13);
    m.add(GL.sphere, look.skin, s * (0.29 + Math.sin(a) * 0.5), 1.17 - Math.cos(a) * 0.5, 0, 0, 0, 0, 0.13, 0.14, 0.13);
  }
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
  addOutline(pivot, 0.025);
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
  addOutline(root, 0.02);
  root.add(blobShadow(0.9));
  return { root, tail, legs };
}

/** Coche del viaje con Azul, Gas y Joy asomada por la ventanilla. Mira hacia +Z. */
export function makeCar(color = 0xd7263d, opts: { luggage?: boolean; joy?: boolean } = {}) {
  const { luggage = true, joy: withJoy = true } = opts;
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
  if (luggage) {
    // Equipaje en la baca
    m.add(G.box, 0x6b4428, 0, 1.55, -0.4, 0, 0, 0, 1.1, 0.25, 1.2);
    m.add(G.box, 0x2f6b46, 0.1, 1.78, -0.3, 0, 0.2, 0, 0.7, 0.22, 0.6);
  }
  // Cabezas en los asientos: Azul (rubia) a la derecha y Gas a la izquierda, al volante en el capítulo 4.
  const azulX = -0.4;
  const gasX = 0.4;
  const a = new Merger();
  a.add(G.sphere, 0xf4d0b0, azulX, 1.18, 0.2, 0, 0, 0, 0.32, 0.36, 0.32);
  a.add(G.sphere, 0xf2d27a, azulX, 1.25, 0.17, 0, 0, 0, 0.36, 0.3, 0.36);
  const azul = a.mesh();
  body.add(azul);
  m.add(G.sphere, 0xe8b894, gasX, 1.18, 0.2, 0, 0, 0, 0.32, 0.36, 0.32);
  m.add(G.sphere, 0x2b1d14, gasX, 1.28, 0.17, 0, 0, 0, 0.34, 0.22, 0.34);
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
  if (withJoy) body.add(joy);
  const wheels: THREE.Object3D[] = [];
  const wGeo = new Merger().add(G.cyl, 0x1a1a1a, 0, 0, 0, 0, 0, Math.PI / 2, 0.68, 0.32, 0.68).add(G.cyl, 0xbbbbbb, 0, 0, 0, 0, 0, Math.PI / 2, 0.34, 0.34, 0.34).build();
  for (const [x, z] of [[-0.85, 1.25], [0.85, 1.25], [-0.85, -1.25], [0.85, -1.25]]) {
    const w = new THREE.Mesh(wGeo, vertexMat);
    w.position.set(x, 0.34, z);
    root.add(w);
    wheels.push(w);
  }
  addOutline(root, 0.03);
  root.add(blobShadow(4));
  return { root, body, joy, wheels, azul };
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
