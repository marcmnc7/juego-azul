import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, addOutline } from '../core/gfx';
import { spring } from '../core/walker';

// Personajes y decorado hechos con primitivas low-poly y sombreado "cel":
// no hay que descargar modelos y el juego entero cabe en un único archivo.

const matCache = new Map<number, THREE.MeshStandardMaterial>();
export function mat(color: number) {
  let m = matCache.get(color);
  if (!m) {
    m = toon({ color });
    matCache.set(color, m);
  }
  return m;
}
// Se crea al primer uso (después de la autocomprobación gráfica, que puede cambiar el tipo de material).
let vMat: THREE.MeshStandardMaterial | null = null;
export function vertexMat() {
  if (!vMat) vMat = toon({ vertexColors: true });
  return vMat;
}

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
    return new THREE.Mesh(this.build(), vertexMat());
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
  /** Mono de una pieza ajustado: mangas y perneras largas del mismo color, cintura marcada. */
  jumpsuit?: boolean;
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
  // Articulaciones: rodillas, tobillos y codos
  kneeL: THREE.Object3D;
  kneeR: THREE.Object3D;
  footL: THREE.Object3D;
  footR: THREE.Object3D;
  elbowL: THREE.Object3D;
  elbowR: THREE.Object3D;
  blink: number;
  t: number;
  /** Mezcla entre animaciones: modo anterior y tiempo de transición restante. */
  mode?: PersonMode;
  blendT?: number;
  /** Mirada: hacia dónde gira la cabeza en reposo y cuándo cambia. */
  lookY?: number;
  lookT?: number;
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
  if (look.jumpsuit) {
    // Ajustado: torso estrecho, cadera que enlaza con las perneras y escote en pico
    torso.add(G.capsule, look.shirt, 0, 1.0, 0, 0, 0, 0, 0.4, 0.3, 0.27);
    torso.add(G.sphere, look.shirt, 0, 0.74, 0, 0, 0, 0, 0.38, 0.22, 0.26);
    torso.add(G.box, look.skin, 0, 1.15, 0.13, 0.25, 0, Math.PI / 4, 0.09, 0.09, 0.02);
    torso.add(G.box, 0x3a3a44, 0, 0.86, 0.135, 0, 0, 0, 0.36, 0.035, 0.02); // cinturón fino
  } else {
    if (look.skirt) torso.add(new THREE.CylinderGeometry(0.2, 0.42, 0.5, 14), look.pants, 0, 0.78, 0);
    torso.add(G.capsule, look.shirt, 0, 1.0, 0, 0, 0, 0, 0.46, 0.3, 0.32);
  }
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

  // Pierna: muslo desde la cadera, rodilla, espinilla y tobillo con el zapato
  const leg = () => {
    const hip = new THREE.Group();
    const skinLeg = look.skirt && !look.jumpsuit ? look.skin : look.pants;
    const w = look.jumpsuit ? 0.88 : 1;
    hip.add(new Merger().add(G.capsule, skinLeg, 0, -0.13, 0, 0, 0, 0, 0.155 * w, 0.135, 0.155 * w).mesh());
    const knee = new THREE.Group();
    knee.position.y = -0.26;
    knee.add(new Merger().add(G.capsule, skinLeg, 0, -0.12, 0, 0, 0, 0, 0.14 * w, 0.13, 0.14 * w).mesh());
    const foot = new THREE.Group();
    foot.position.y = -0.25;
    foot.add(new Merger().add(G.rbox, shoes, 0, -0.07, 0.04, 0, 0, 0, 0.17, 0.12, 0.28).mesh());
    knee.add(foot);
    hip.add(knee);
    return { hip, knee, foot };
  };
  // Brazo: hombro, codo y mano
  const arm = () => {
    const shoulder = new THREE.Group();
    shoulder.add(new Merger().add(G.capsule, look.shirt, 0, -0.12, 0, 0, 0, 0, 0.14, 0.13, 0.14).mesh());
    const elbow = new THREE.Group();
    elbow.position.y = -0.24;
    elbow.add(
      new Merger()
        .add(G.capsule, look.jumpsuit ? look.shirt : look.skin, 0, -0.1, 0, 0, 0, 0, 0.1, 0.11, 0.1)
        .add(G.sphere, look.skin, 0, -0.23, 0.01, 0, 0, 0, 0.13, 0.14, 0.13)
        .mesh(),
    );
    shoulder.add(elbow);
    return { shoulder, elbow };
  };
  const lL = leg();
  const lR = leg();
  const legL = lL.hip;
  const legR = lR.hip;
  legL.position.set(-0.11, 0.66, 0);
  legR.position.set(0.11, 0.66, 0);
  const aL = arm();
  const aR = arm();
  const armL = aL.shoulder;
  const armR = aR.shoulder;
  armL.position.set(-0.29, 1.17, 0);
  armR.position.set(0.29, 1.17, 0);
  const handR = new THREE.Object3D();
  handR.position.set(0, -0.24, 0.06);
  aR.elbow.add(handR);
  body.add(legL, legR, armL, armR);

  if (outline) addOutline(body, 0.02);
  root.add(blobShadow(1.1));
  root.scale.setScalar(scale);
  return {
    root, body, head, eyes, legL, legR, armL, armR, handR,
    kneeL: lL.knee, kneeR: lR.knee, footL: lL.foot, footR: lR.foot, elbowL: aL.elbow, elbowR: aR.elbow,
    blink: 2 + Math.random() * 3, t: Math.random() * 10,
  };
}

/** Anima un personaje: andar, bailar, saludar, celebrar, hablar o reposo (respira y parpadea). */
export interface Lean {
  leanFwd: number;
  leanSide: number;
}

/**
 * Animación procedural del cuerpo con rodillas, tobillos y codos.
 * - 'walk': phase es la fase del paso (ligada a la distancia) y move la velocidad 0..1. La pierna
 *   que avanza dobla la rodilla para no arrastrar el pie, la de apoyo se estira y el tobillo mantiene
 *   la suela plana; de andar a correr la zancada se alarga, la rodilla sube más y los codos se doblan.
 * - Al cambiar de animación no hay saltos: se mezcla con la postura anterior durante un instante.
 * - Con lean, todo el cuerpo se inclina al acelerar y hacia dentro en las curvas.
 */
export function animatePerson(p: Person, dt: number, mode: PersonMode, move = 0, phase?: number, lean?: Lean) {
  p.t += dt;
  const t = phase ?? p.t;
  // Parpadeo
  p.blink -= dt;
  if (p.blink < 0) p.blink = 2.5 + Math.random() * 3;
  p.eyes.scale.y = p.blink < 0.12 ? 0.15 : 1;

  // Transición suave entre animaciones
  if (p.mode !== mode) {
    p.blendT = p.mode ? 0.28 : 0;
    p.mode = mode;
  }
  const joints = [p.body, p.head, p.armL, p.armR, p.elbowL, p.elbowR, p.legL, p.legR, p.kneeL, p.kneeR, p.footL, p.footR];
  const blending = (p.blendT ?? 0) > 0;
  const prev = blending ? joints.map((j) => [j.rotation.x, j.rotation.y, j.rotation.z]) : null;
  const prevY = p.body.position.y;

  for (const j of joints) j.rotation.set(0, 0, 0);
  p.armL.rotation.z = -0.1;
  p.armR.rotation.z = 0.1;
  p.elbowL.rotation.x = p.elbowR.rotation.x = -0.15;
  p.body.position.y = 0;

  switch (mode) {
    case 'walk': {
      const k = Math.min(1, move);
      const run = THREE.MathUtils.smoothstep(k, 0.45, 0.9);
      const hipAmp = 0.32 + 0.3 * k + 0.12 * run;
      const leg = (hip: THREE.Object3D, knee: THREE.Object3D, foot: THREE.Object3D, ph: number) => {
        const sn = Math.sin(ph);
        const cs = Math.cos(ph);
        // Positivo = pierna hacia atrás. Avanza (swing) cuando cs < 0
        const h = sn * hipAmp - 0.06 * run;
        const swing = Math.max(0, -cs);
        const kneeFlex = (0.12 + 0.05 * k) * Math.max(0, cs) + swing * swing * (0.55 + 0.45 * k + 0.6 * run) + 0.08 * run;
        hip.rotation.x = h;
        knee.rotation.x = kneeFlex;
        // Suela plana en el apoyo; en el aire la punta sube un poco (y al despegar empuja)
        foot.rotation.x = -(h + kneeFlex) * 0.85 - swing * 0.15 + Math.max(0, sn) * Math.max(0, cs) * 0.5 * k;
      };
      leg(p.legL, p.kneeL, p.footL, t);
      leg(p.legR, p.kneeR, p.footR, t + Math.PI);
      const s = Math.sin(t);
      const c = Math.cos(t);
      // Altura: baja en el apoyo con la rodilla doblada, sube al pasar por encima de la pierna
      p.body.position.y = (Math.abs(c) * (0.02 + 0.05 * run) - 0.015 - 0.04 * run) * Math.max(k, 0.3);
      // Caderas y hombros en contra
      p.body.rotation.y = -s * (0.05 + 0.09 * run) * k;
      p.body.rotation.z = s * 0.03 * k * (1 - run * 0.5);
      // Brazos opuestos a las piernas; el codo se dobla más cuando el brazo va delante
      const armAmp = 0.22 + 0.3 * k + 0.15 * run;
      const arm = (sh: THREE.Object3D, el: THREE.Object3D, sgn: number) => {
        const a = -sgn * s * armAmp;
        sh.rotation.x = a - 0.1 * run;
        el.rotation.x = -(0.2 + 0.25 * k + 1.0 * run) - Math.max(0, -a) * (0.5 + 0.3 * run);
      };
      arm(p.armL, p.elbowL, 1);
      arm(p.armR, p.elbowR, -1);
      p.armL.rotation.z = -0.08 - 0.08 * run;
      p.armR.rotation.z = 0.08 + 0.08 * run;
      // La cabeza estabiliza la mirada
      p.head.rotation.y = -p.body.rotation.y * 0.85;
      p.head.rotation.x = 0.04 * k - Math.abs(c) * 0.025 * run;
      p.head.rotation.z = -p.body.rotation.z * 0.7;
      break;
    }
    case 'dance': {
      const s = Math.sin(t);
      const b = Math.abs(Math.sin(t * 0.5));
      // Rebote con las rodillas, no con todo el cuerpo rígido
      const bend = 0.25 + 0.3 * (1 - b);
      p.body.position.y = b * 0.18 - 0.05;
      p.legL.rotation.x = -bend * 0.6 - Math.max(0, s) * 0.35;
      p.legR.rotation.x = -bend * 0.6 - Math.max(0, -s) * 0.35;
      p.kneeL.rotation.x = bend + Math.max(0, s) * 0.5;
      p.kneeR.rotation.x = bend + Math.max(0, -s) * 0.5;
      p.footL.rotation.x = -(p.legL.rotation.x + p.kneeL.rotation.x) * 0.8;
      p.footR.rotation.x = -(p.legR.rotation.x + p.kneeR.rotation.x) * 0.8;
      p.body.rotation.y = Math.sin(t * 0.5) * 0.3;
      p.body.rotation.z = s * 0.06;
      p.armL.rotation.z = -2.3 + s * 0.35;
      p.armR.rotation.z = 2.3 - s * 0.35;
      p.elbowL.rotation.z = -0.4 - Math.max(0, s) * 0.5;
      p.elbowR.rotation.z = 0.4 + Math.max(0, -s) * 0.5;
      p.elbowL.rotation.x = p.elbowR.rotation.x = 0;
      p.head.rotation.z = s * 0.12;
      p.head.rotation.x = -0.05 + b * 0.08;
      break;
    }
    case 'cheer': {
      // Saltos de alegría: se agacha, impulsa y aterriza flexionando
      const ph = (t * 1.2) % Math.PI;
      const air = Math.sin(ph);
      p.body.position.y = air * 0.2 - (1 - air) * 0.04;
      const crouch = (1 - air) * 0.45;
      p.legL.rotation.x = p.legR.rotation.x = -crouch * 0.6;
      p.kneeL.rotation.x = p.kneeR.rotation.x = crouch;
      p.footL.rotation.x = p.footR.rotation.x = -crouch * 0.4 + air * 0.35;
      p.armL.rotation.z = -2.7;
      p.armR.rotation.z = 2.7 + Math.sin(t * 3) * 0.15;
      p.elbowL.rotation.x = p.elbowR.rotation.x = -0.15;
      p.head.rotation.x = -0.12;
      break;
    }
    case 'wave': {
      // El brazo arriba y la mano saluda desde el codo
      p.armR.rotation.z = 2.5;
      p.armR.rotation.x = -0.2;
      p.elbowR.rotation.z = Math.sin(t * 7) * 0.45;
      p.elbowR.rotation.x = -0.2;
      p.head.rotation.z = Math.sin(t * 2) * 0.06;
      p.body.rotation.z = -0.03;
      p.kneeL.rotation.x = 0.08;
      p.body.position.y = Math.sin(t * 2) * 0.008;
      break;
    }
    case 'talk': {
      p.head.rotation.x = Math.sin(t * 6) * 0.05;
      p.head.rotation.y = Math.sin(t * 0.9) * 0.12;
      p.armR.rotation.x = -0.35 + Math.sin(t * 3) * 0.12;
      p.armR.rotation.z = 0.25;
      p.elbowR.rotation.x = -0.9 + Math.sin(t * 3 + 0.6) * 0.3;
      p.elbowL.rotation.x = -0.2;
      p.body.rotation.y = Math.sin(t * 0.9) * 0.05;
      break;
    }
    default: {
      // Reposo: respira, carga el peso en una pierna (con la otra rodilla suelta) y mira alrededor
      p.body.position.y = Math.sin(t * 2) * 0.008;
      const w = Math.sin(t * 0.37);
      p.body.rotation.z = w * 0.025;
      p.kneeL.rotation.x = Math.max(0, w) * 0.16;
      p.kneeR.rotation.x = Math.max(0, -w) * 0.16;
      p.legL.rotation.x = -Math.max(0, w) * 0.06;
      p.legR.rotation.x = -Math.max(0, -w) * 0.06;
      p.footL.rotation.x = -(p.legL.rotation.x + p.kneeL.rotation.x);
      p.footR.rotation.x = -(p.legR.rotation.x + p.kneeR.rotation.x);
      p.armL.rotation.z = -0.1 - Math.sin(t * 2) * 0.015;
      p.armR.rotation.z = 0.1 + Math.sin(t * 2) * 0.015;
      p.armL.rotation.x = p.armR.rotation.x = 0.03;
      // Mirada: elige un punto, gira la cabeza con suavidad y se queda un rato
      p.lookT = (p.lookT ?? 0) - dt;
      if (p.lookT <= 0) {
        p.lookT = 1.5 + Math.random() * 3;
        p.lookY = (Math.random() - 0.5) * 0.9;
      }
      const ly = p.lookY ?? 0;
      p.head.rotation.y = prevHeadY(p) + (ly - prevHeadY(p)) * Math.min(1, dt * 3);
      p.head.rotation.z = -p.body.rotation.z * 0.6;
      p.head.rotation.x = Math.sin(t * 0.7) * 0.03;
    }
  }
  if (lean) {
    p.body.rotation.x += lean.leanFwd;
    p.body.rotation.z += lean.leanSide;
  }
  if (prev) {
    p.blendT = (p.blendT ?? 0) - dt;
    const a = Math.min(1, dt * 11);
    joints.forEach((j, i) => {
      j.rotation.x = prev[i][0] + (j.rotation.x - prev[i][0]) * a;
      j.rotation.y = prev[i][1] + (j.rotation.y - prev[i][1]) * a;
      j.rotation.z = prev[i][2] + (j.rotation.z - prev[i][2]) * a;
    });
    p.body.position.y = prevY + (p.body.position.y - prevY) * a;
  }
  p.head.userData.lookY = p.head.rotation.y;
}

/** Giro de cabeza del fotograma anterior (para que la mirada se mueva con suavidad). */
function prevHeadY(p: Person) {
  return (p.head.userData.lookY as number | undefined) ?? 0;
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
    p.add(new THREE.Mesh(legGeo, vertexMat()));
    inner.add(p);
    legs.push(p);
  }
  addOutline(pivot, 0.025);
  root.add(blobShadow(2.2));
  return { root, pivot, legs, head };
}

/** Caballo menorquín negro con su caixer, como los de Sant Joan: alto, crin larga y escarapelas. Mira hacia +Z. */
export function makeHorse(coat = 0x0e0c0b): Donkey {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.z = -0.85; // eje en las patas traseras: así se pone de manos (el «bot»)
  root.add(pivot);
  const inner = new THREE.Group();
  inner.position.z = 0.85;
  pivot.add(inner);
  const shine = 0x2a2522;

  const b = new Merger();
  b.add(G.capsule, coat, 0, 1.55, 0, Math.PI / 2, 0, 0, 0.82, 0.95, 0.8); // tronco
  b.add(G.sphere, coat, 0, 1.5, -0.7, 0, 0, 0, 0.82, 0.78, 0.7); // grupa
  b.add(G.sphere, coat, 0, 1.6, 0.7, 0, 0, 0, 0.8, 0.82, 0.7); // pecho
  b.add(G.sphere, shine, 0.2, 1.75, 0.2, 0, 0, 0, 0.3, 0.2, 0.6); // brillo del pelo
  // Silla, sudadero blanco y cincha
  b.add(G.rbox, 0xf4f1ea, 0, 1.98, -0.05, 0, 0, 0, 0.86, 0.06, 0.9);
  b.add(G.rbox, 0x2a1a12, 0, 2.06, -0.05, 0, 0, 0, 0.5, 0.1, 0.62);
  b.add(G.box, 0x2a1a12, 0, 1.55, 0.05, 0, 0, 0, 0.84, 0.08, 0.1);
  // Cola larga, con lazo
  b.add(G.capsule, coat, 0, 1.25, -1.15, -0.35, 0, 0, 0.16, 0.85, 0.12);
  b.add(G.box, 0xd7263d, 0, 1.62, -1.05, -0.35, 0, 0, 0.18, 0.08, 0.1);
  // Caixer: casaca negra, pantalón blanco, botas y capell
  b.add(G.capsule, 0xf3f0ea, -0.3, 2.05, 0.05, 0.3, 0, 0, 0.18, 0.36, 0.18);
  b.add(G.capsule, 0xf3f0ea, 0.3, 2.05, 0.05, 0.3, 0, 0, 0.18, 0.36, 0.18);
  b.add(G.capsule, 0x111111, -0.36, 1.68, 0.15, 0, 0, 0, 0.14, 0.32, 0.14);
  b.add(G.capsule, 0x111111, 0.36, 1.68, 0.15, 0, 0, 0, 0.14, 0.32, 0.14);
  b.add(G.capsule, 0x16161c, 0, 2.6, -0.02, 0, 0, 0, 0.44, 0.44, 0.32);
  b.add(G.box, 0xffffff, 0, 2.66, 0.14, 0, 0, 0, 0.16, 0.3, 0.04);
  b.add(G.sphere, 0xe8b894, 0, 3.08, 0, 0, 0, 0, 0.34, 0.38, 0.34);
  b.add(G.box, 0x111111, 0, 3.3, 0, 0, 0, 0, 0.62, 0.1, 0.3); // capell de dos picos
  b.add(G.cyl, 0x111111, 0, 3.36, 0, 0, 0, 0, 0.3, 0.14, 0.3);
  b.add(G.capsule, 0x16161c, -0.26, 2.62, 0.25, 1.1, 0, 0, 0.11, 0.22, 0.11);
  b.add(G.capsule, 0x16161c, 0.26, 2.62, 0.25, 1.1, 0, 0, 0.11, 0.22, 0.11);
  inner.add(b.mesh());

  const head = new THREE.Group();
  head.position.set(0, 1.85, 0.95);
  const h = new Merger();
  h.add(G.capsule, coat, 0, 0.35, 0.12, 0.45, 0, 0, 0.36, 0.62, 0.34); // cuello alto
  h.add(G.box, coat, 0, 0.6, 0.12, 0.45, 0, 0, 0.06, 0.8, 0.3); // crin
  h.add(G.capsule, coat, 0, 0.82, 0.48, 1.25, 0, 0, 0.26, 0.5, 0.28); // cabeza alargada
  h.add(G.sphere, 0x1d1917, 0, 0.66, 0.78, 0, 0, 0, 0.24, 0.22, 0.22); // morro
  h.add(G.box, coat, -0.09, 1.14, 0.32, -0.2, 0, -0.15, 0.06, 0.18, 0.08); // orejas cortas
  h.add(G.box, coat, 0.09, 1.14, 0.32, -0.2, 0, 0.15, 0.06, 0.18, 0.08);
  h.add(G.sphere, 0xffffff, -0.15, 0.92, 0.5, 0, 0, 0, 0.05, 0.06, 0.06);
  h.add(G.sphere, 0xffffff, 0.15, 0.92, 0.5, 0, 0, 0, 0.05, 0.06, 0.06);
  // Escarapelas en la frente y bridas
  h.add(G.cyl, 0xd7263d, 0, 1.0, 0.42, 1.2, 0, 0, 0.18, 0.04, 0.18);
  h.add(G.cyl, 0xf4f1ea, 0, 1.0, 0.43, 1.2, 0, 0, 0.09, 0.05, 0.09);
  h.add(G.box, 0x6b4428, -0.15, 0.75, 0.6, 1.2, 0, 0, 0.03, 0.45, 0.03);
  h.add(G.box, 0x6b4428, 0.15, 0.75, 0.6, 1.2, 0, 0, 0.03, 0.45, 0.03);
  head.add(h.mesh());
  inner.add(head);

  const legs: THREE.Object3D[] = [];
  const legGeo = new Merger()
    .add(G.capsule, coat, 0, -0.35, 0, 0, 0, 0, 0.2, 0.55, 0.2)
    .add(G.cyl, coat, 0, -0.85, 0, 0, 0, 0, 0.12, 0.55, 0.12)
    .add(G.cyl, 0x222222, 0, -1.15, 0.02, 0, 0, 0, 0.17, 0.1, 0.19)
    .build();
  for (const [x, z] of [[-0.25, 0.68], [0.25, 0.68], [-0.25, -0.72], [0.25, -0.72]]) {
    const p = new THREE.Group();
    p.position.set(x, 1.2, z);
    p.add(new THREE.Mesh(legGeo, vertexMat()));
    inner.add(p);
    legs.push(p);
  }
  addOutline(pivot, 0.025);
  root.add(blobShadow(2.8));
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
    p.add(new THREE.Mesh(legGeo, vertexMat()));
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
    const w = new THREE.Mesh(wGeo, vertexMat());
    w.position.set(x, 0.34, z);
    root.add(w);
    wheels.push(w);
  }
  addOutline(root, 0.03);
  root.add(blobShadow(4));
  return { root, body, joy, wheels, azul };
}

/** Moto (la de Gas) con él montado y casco. Mira hacia +Z. */
export function makeMoto(color = 0x1b1d22, rider?: PersonLook) {
  const root = new THREE.Group();
  const m = new Merger();
  // Chasis, depósito, asiento, colín y horquilla
  m.add(G.rbox, color, 0, 0.72, 0.15, 0, 0, 0, 0.36, 0.3, 0.75); // depósito
  m.add(G.rbox, 0x111111, 0, 0.8, -0.45, 0, 0, 0, 0.32, 0.12, 0.7); // asiento
  m.add(G.rbox, color, 0, 0.78, -0.92, -0.25, 0, 0, 0.26, 0.12, 0.35); // colín
  m.add(G.box, 0x3a3a3e, 0, 0.5, -0.1, 0, 0, 0, 0.28, 0.3, 0.8); // motor
  m.add(G.cyl, 0x9a9aa2, 0.2, 0.38, -0.55, Math.PI / 2 - 0.15, 0, 0, 0.1, 0.8, 0.1); // escape
  for (const sx of [-0.09, 0.09]) m.add(G.cyl, 0xb8b8c0, sx, 0.65, 0.68, -0.35, 0, 0, 0.05, 0.75, 0.05); // horquilla
  m.add(G.cyl, 0x222222, 0, 1.02, 0.62, 0, 0, Math.PI / 2, 0.04, 0.75, 0.04); // manillar
  m.add(G.sphere, 0xfff3b0, 0, 0.9, 0.82, 0, 0, 0, 0.2, 0.2, 0.12); // faro
  m.add(G.box, 0xff3030, 0, 0.82, -1.1, 0, 0, 0, 0.14, 0.06, 0.04); // piloto
  const wGeo = new Merger().add(G.cyl, 0x151515, 0, 0, 0, 0, 0, Math.PI / 2, 0.66, 0.14, 0.66).add(G.cyl, 0xa8a8b0, 0, 0, 0, 0, 0, Math.PI / 2, 0.3, 0.16, 0.3).build();
  const wheels: THREE.Object3D[] = [];
  for (const z of [0.8, -0.78]) {
    const w = new THREE.Mesh(wGeo, vertexMat());
    w.position.set(0, 0.33, z);
    root.add(w);
    wheels.push(w);
  }
  root.add(m.mesh());
  let person: Person | null = null;
  if (rider) {
    person = makePerson(rider);
    person.root.position.set(0, 0.42, -0.42);
    // Sentado con las manos en el manillar
    person.legL.rotation.x = person.legR.rotation.x = -1.2;
    person.kneeL.rotation.x = person.kneeR.rotation.x = 1.5;
    person.legL.rotation.z = -0.15;
    person.legR.rotation.z = 0.15;
    person.armL.rotation.x = person.armR.rotation.x = -1.1;
    person.body.rotation.x = 0.25;
    const helmet = new Merger().add(G.ball, 0x1b1d22, 0, 0.3, -0.02, 0, 0, 0, 0.68, 0.64, 0.66).add(G.box, 0x223040, 0, 0.3, 0.3, 0, 0, 0, 0.5, 0.2, 0.06).mesh();
    person.head.add(helmet);
    root.add(person.root);
  }
  addOutline(root, 0.02);
  root.add(blobShadow(1.4));
  return { root, wheels, rider: person };
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

/**
 * Suspensión de coche: la carrocería cabecea al acelerar y frenar, se inclina hacia fuera en las
 * curvas y vibra con el asfalto, con muelles poco amortiguados (rebota un poco y se asienta). Las
 * ruedas giran según la distancia recorrida.
 */
export class CarRig {
  private pitch = 0;
  private pitchV = 0;
  private roll = 0;
  private rollV = 0;
  private bounce = 0;
  private bounceV = 0;
  private prevSpeed = 0;
  private accelF = 0;
  private t = 0;
  constructor(private car: { body: THREE.Object3D; wheels: THREE.Object3D[] }) {}

  private static osc(x: number, v: number, target: number, omega: number, zeta: number, dt: number): [number, number] {
    v += (omega * omega * (target - x) - 2 * zeta * omega * v) * dt;
    return [x + v * dt, v];
  }

  /** Golpe seco (bache, roce): un empujón a la suspensión. */
  kick(roll: number, bounce = 0) {
    this.rollV += roll;
    this.bounceV += bounce;
  }

  /** speed: m/s hacia delante; lateral: aceleración lateral en m/s² (+ = hacia la izquierda del coche, eje x local). */
  update(dt: number, speed: number, lateral = 0, rough = 1) {
    if (dt <= 0) return;
    const h = Math.min(dt, 1 / 30);
    this.t += dt;
    const raw = (speed - this.prevSpeed) / dt;
    this.prevSpeed = speed;
    [this.accelF] = spring(this.accelF, 0, raw, 12, dt);
    const sp = Math.min(1, Math.abs(speed) / 10);
    const road = (Math.sin(this.t * 23.0) * 0.5 + Math.sin(this.t * 37.0 + 1.3) * 0.3 + Math.sin(this.t * 7.1) * 0.6) * 0.008 * sp * rough;
    [this.bounce, this.bounceV] = CarRig.osc(this.bounce, this.bounceV, road, 16, 0.35, h);
    [this.pitch, this.pitchV] = CarRig.osc(this.pitch, this.pitchV, THREE.MathUtils.clamp(-this.accelF * 0.007, -0.06, 0.06), 8, 0.4, h);
    [this.roll, this.rollV] = CarRig.osc(this.roll, this.rollV, THREE.MathUtils.clamp(lateral * 0.009, -0.07, 0.07), 8, 0.38, h);
    const b = this.car.body;
    b.position.y = this.bounce + Math.abs(this.pitch) * 0.3;
    b.rotation.x = this.pitch;
    b.rotation.z = this.roll;
    for (const w of this.car.wheels) w.rotation.x += (speed * dt) / 0.34;
  }
}
