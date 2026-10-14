import * as THREE from 'three';
import { G, Merger, personGeometry, vertexMat, PersonLook } from '../entities/models';
import { Sky, Sun, toon, glowTexture } from '../core/gfx';

// Ferreries en fiestas al atardecer: calle mayor de este a oeste, plaza con la iglesia al norte,
// casas encaladas con persianas verdes, macetas, farolillos, banderines y bares llenos.

export interface Box2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Crowd {
  mesh: THREE.InstancedMesh;
  base: { x: number; z: number; ry: number; phase: number; speed: number }[];
}

export interface FerreriesWorld {
  group: THREE.Group;
  colliders: Box2[];
  bounds: Box2;
  spawn: THREE.Vector3;
  pomadaSpots: THREE.Vector3[];
  tofolPos: THREE.Vector3;
  marcPos: THREE.Vector3;
  plazaCenter: THREE.Vector3;
  crowds: Crowd[];
  lights: THREE.Points;
  sky: Sky;
  sun: Sun;
}

// Prisma unitario para tejados a dos aguas: cumbrera a lo largo de X, base en y=0, altura 1.
export const ROOF_GEO = (() => {
  const sh = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-0.5, 0, 0);
  return g;
})();

const WHITE = [0xfbf7ee, 0xf6f0e3, 0xfdfaf3, 0xf3ead8];
const SHUTTERS = [0x2f6b46, 0x2f6b46, 0x3a7d55, 0x2b5f8a];
const ROOF = 0xc0653d;
const MARES = 0xd8c39a; // piedra de marès de las esquinas
const FLOWERS = [0xe0245e, 0xff5a7a, 0xd7263d, 0xf28f3b];

export function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function groundTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#9d8a6c';
  ctx.fillRect(0, 0, S, S);
  const r = rand(7);
  const cell = 64;
  for (let y = 0; y < S; y += cell / 2) {
    const off = (y / (cell / 2)) % 2 ? cell / 2 : 0;
    for (let x = -cell; x < S + cell; x += cell) {
      const v = 190 + Math.floor(r() * 35);
      const w = cell - 6 - r() * 4;
      const h = cell / 2 - 5 - r() * 3;
      const px = x + off + 3;
      const py = y + 3;
      ctx.fillStyle = `rgb(${v},${v - 12},${v - 34})`;
      ctx.beginPath();
      ctx.roundRect(px, py, w, h, 7);
      ctx.fill();
      // brillo superior
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.roundRect(px + 3, py + 2, w - 8, h * 0.35, 5);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(26, 26);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

interface Lamp {
  p: THREE.Vector3;
}

/** Casa menorquina: blanca, esquinas de marès, persianas, balcón con macetas, tejado de teja. */
function house(m: Merger, cx: number, cz: number, w: number, d: number, floors: number, facing: 1 | -1, r: () => number, colliders: Box2[], lamps: Lamp[]) {
  const h = floors * 3 + 0.4;
  const wall = WHITE[Math.floor(r() * WHITE.length)];
  const shutter = SHUTTERS[Math.floor(r() * SHUTTERS.length)];
  m.add(G.box, wall, cx, h / 2, cz, 0, 0, 0, w, h, d);
  // Esquinas de piedra y alero
  for (const sx of [-1, 1]) m.add(G.box, MARES, cx + sx * (w / 2 - 0.2), h / 2, cz + facing * (d / 2 - 0.15), 0, 0, 0, 0.42, h, 0.34);
  m.add(G.box, 0xe9dcc2, cx, h - 0.1, cz + facing * (d / 2 + 0.05), 0, 0, 0, w + 0.1, 0.2, 0.25);
  m.add(ROOF_GEO, ROOF, cx, h, cz, 0, 0, 0, w + 0.3, 1.5, d + 0.5);
  m.add(G.box, 0xd8cbb2, cx, 0.35, cz + facing * (d / 2 + 0.01), 0, 0, 0, w, 0.7, 0.04); // zócalo
  const fz = cz + facing * (d / 2 + 0.06);
  const cols = Math.max(1, Math.floor(w / 2.4));
  const balconyFloor = floors > 1 && r() < 0.7 ? 1 : -1;
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < cols; i++) {
      const x = cx - w / 2 + (w / cols) * (i + 0.5);
      const y = f * 3 + 1.6;
      if (f === 0 && i === Math.floor(cols / 2)) {
        // Puerta con marco de piedra y farol al lado
        m.add(G.box, MARES, x, 1.25, fz - facing * 0.02, 0, 0, 0, 1.5, 2.6, 0.1);
        m.add(G.box, [0x6b4428, 0x2f6b46, 0x5b3a8a][Math.floor(r() * 3)], x, 1.15, fz + facing * 0.02, 0, 0, 0, 1.1, 2.3, 0.1);
        m.add(G.sphere, 0xd9b45a, x + 0.35, 1.15, fz + facing * 0.08, 0, 0, 0, 0.08, 0.08, 0.08);
        if (r() < 0.6) {
          m.add(G.box, 0x222222, x + 1.0, 2.6, fz + facing * 0.15, 0, 0, 0, 0.06, 0.06, 0.3);
          m.add(G.box, 0x222222, x + 1.0, 2.45, fz + facing * 0.3, 0, 0, 0, 0.26, 0.36, 0.26);
          lamps.push({ p: new THREE.Vector3(x + 1.0, 2.45, fz + facing * 0.3) });
        }
      } else {
        m.add(G.box, 0xffffff, x, y, fz - facing * 0.02, 0, 0, 0, 1.38, 1.58, 0.08); // marco
        m.add(G.box, shutter, x - 0.31, y, fz + facing * 0.02, 0, 0, 0, 0.58, 1.42, 0.08);
        m.add(G.box, shutter, x + 0.31, y, fz + facing * 0.02, 0, 0, 0, 0.58, 1.42, 0.08);
        for (let k = -2; k <= 2; k++) m.add(G.box, darken(shutter), x + (k < 0 ? -0.31 : 0.31), y + k * 0.25, fz + facing * 0.07, 0, 0, 0, 0.5, 0.04, 0.02);
        if (f === balconyFloor) {
          m.add(G.box, 0xe9dcc2, x, y - 0.85, fz + facing * 0.4, 0, 0, 0, 1.8, 0.12, 0.8);
          for (let k = -4; k <= 4; k++) m.add(G.box, 0x222222, x + k * 0.2, y - 0.5, fz + facing * 0.78, 0, 0, 0, 0.03, 0.6, 0.03);
          m.add(G.box, 0x222222, x, y - 0.2, fz + facing * 0.78, 0, 0, 0, 1.8, 0.04, 0.04);
          for (let k = -1; k <= 1; k++) {
            m.add(G.cyl, 0xb5603b, x + k * 0.55, y - 0.65, fz + facing * 0.5, 0, 0, 0, 0.28, 0.28, 0.28);
            m.add(G.sphere, 0x3e7a3a, x + k * 0.55, y - 0.4, fz + facing * 0.5, 0, 0, 0, 0.42, 0.3, 0.42);
            m.add(G.sphere, FLOWERS[Math.floor(r() * 4)], x + k * 0.55, y - 0.28, fz + facing * 0.55, 0, 0, 0, 0.3, 0.18, 0.3);
          }
        } else {
          m.add(G.box, 0xffffff, x, y - 0.82, fz + facing * 0.08, 0, 0, 0, 1.5, 0.1, 0.28);
          if (r() < 0.35) {
            m.add(G.cyl, 0xb5603b, x, y - 0.65, fz + facing * 0.16, 0, 0, 0, 0.3, 0.26, 0.3);
            m.add(G.sphere, FLOWERS[Math.floor(r() * 4)], x, y - 0.42, fz + facing * 0.16, 0, 0, 0, 0.4, 0.28, 0.4);
          }
        }
      }
    }
  }
  // Buganvilla en algunas fachadas
  if (r() < 0.25) {
    const bx = cx + (r() - 0.5) * (w - 2);
    for (let k = 0; k < 6; k++) m.add(G.sphere, k % 2 ? 0xd6338a : 0x3e7a3a, bx + (r() - 0.5) * 1.6, 1 + r() * 2.5, fz + facing * 0.2, 0, 0, 0, 0.9, 0.7, 0.4);
  }
  // Maceta grande junto a la puerta
  if (r() < 0.5) {
    const px = cx + (r() < 0.5 ? -1 : 1) * (w / 2 - 0.8);
    m.add(G.cyl, 0xb5603b, px, 0.3, fz + facing * 0.4, 0, 0, 0, 0.6, 0.6, 0.6);
    m.add(G.sphere, 0x3e7a3a, px, 0.9, fz + facing * 0.4, 0, 0, 0, 0.9, 0.9, 0.9);
  }
  colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
}

const darken = (c: number) => new THREE.Color(c).multiplyScalar(0.8).getHex();

function bar(m: Merger, x: number, z: number, facing: 1 | -1, awning: number, colliders: Box2[], name: string, signs: THREE.Object3D[]) {
  // Toldo a rayas con faldón ondulado
  for (let i = 0; i < 7; i++) {
    const c = i % 2 ? 0xffffff : awning;
    m.add(G.box, c, x - 3 + i + 0.5, 3.25, z - facing * 0.3, facing * 0.3, 0, 0, 1, 0.07, 2.4);
    m.add(G.cyl, c, x - 3 + i + 0.5, 2.85, z + facing * 0.85, Math.PI / 2, 0, 0, 1, 0.07, 0.5);
  }
  for (const sx of [-3, 3]) m.add(G.cyl, 0x444444, x + sx, 1.5, z + facing * 0.85, 0, 0, 0, 0.08, 3, 0.08);
  // Barra
  m.add(G.rbox, 0x8a5a36, x, 0.55, z, 0, 0, 0, 4, 1.1, 0.8);
  m.add(G.box, 0xd9c7a5, x, 1.13, z, 0, 0, 0, 4.2, 0.06, 1);
  colliders.push({ minX: x - 2, maxX: x + 2, minZ: z - 0.45, maxZ: z + 0.45 });
  // Botellas y vasos
  for (let i = 0; i < 7; i++) m.add(G.cyl, [0x2f7d4a, 0x9fd3e8, 0xe9e2b8][i % 3], x - 1.6 + i * 0.52, 1.36, z - facing * 0.25, 0, 0, 0, 0.11, 0.42, 0.11);
  for (let i = 0; i < 4; i++) m.add(G.cyl, 0xfff4b0, x - 1 + i * 0.6, 1.24, z + facing * 0.2, 0, 0, 0, 0.12, 0.18, 0.12);
  // Barril
  m.add(G.cyl, 0x7a4a2a, x + 2.6, 0.5, z, 0, 0, 0, 0.8, 1, 0.8);
  // Letrero
  const tex = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#' + new THREE.Color(awning).getHexString();
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(x, 3.75, z + facing * 0.9);
  if (facing < 0) sign.rotation.y = Math.PI;
  signs.push(sign);
}

function table(m: Merger, x: number, z: number, colliders: Box2[], r: () => number) {
  m.add(G.cyl, 0xeeeeee, x, 0.75, z, 0, 0, 0, 1.1, 0.05, 1.1);
  m.add(G.cyl, 0x777777, x, 0.37, z, 0, 0, 0, 0.08, 0.75, 0.08);
  m.add(G.cyl, 0x777777, x, 0.03, z, 0, 0, 0, 0.5, 0.05, 0.5);
  for (const a of [0, Math.PI]) {
    const cx = x + Math.cos(a) * 0.95;
    const cz = z + Math.sin(a) * 0.95;
    m.add(G.box, 0xd2a15b, cx, 0.45, cz, 0, 0, 0, 0.45, 0.06, 0.45);
    m.add(G.box, 0xd2a15b, cx + Math.cos(a) * 0.2, 0.75, cz, 0, 0, 0, 0.06, 0.6, 0.45);
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) m.add(G.box, 0x9a6a3a, cx + dx, 0.22, cz + dz, 0, 0, 0, 0.04, 0.45, 0.04);
  }
  if (r() < 0.8) m.add(G.cyl, 0xe9e2b8, x + 0.25, 0.86, z - 0.1, 0, 0, 0, 0.12, 0.18, 0.12);
  colliders.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.55, maxZ: z + 0.55 });
}

export function buildFerreries(scene: THREE.Scene): FerreriesWorld {
  const group = new THREE.Group();
  const colliders: Box2[] = [];
  const lamps: Lamp[] = [];
  const signs: THREE.Object3D[] = [];
  const r = rand(42);

  scene.fog = new THREE.Fog(0xf0a585, 35, 110);
  const sky = new Sky({
    top: 0x3b3a85,
    mid: 0xf0907e,
    bottom: 0xffd08a,
    sun: { color: 0xffc070, dir: new THREE.Vector3(-1, 0.18, 0.3), size: 140 },
    clouds: { count: 10, tint: 0xffc6b0 },
  });
  group.add(sky.group);

  group.add(new THREE.HemisphereLight(0xffe9d6, 0x6f5a80, 1.5));
  const sun = new Sun(scene, 0xffc490, 2.4, new THREE.Vector3(-1, 0.9, 0.35), 24);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), toon({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2;
  ground.userData.noCast = true;
  group.add(ground);

  const m = new Merger();

  // Calle mayor (z -5..5) y plaza (x -12..12, z 5..26)
  let x = -50;
  while (x < 50) {
    const w = 5 + Math.floor(r() * 4);
    house(m, x + w / 2, -9, w, 8, 1 + Math.floor(r() * 3), 1, r, colliders, lamps);
    x += w;
  }
  for (const [from, to] of [[-50, -12], [12, 50]]) {
    x = from;
    while (x < to) {
      const w = Math.min(to - x, 5 + Math.floor(r() * 4));
      house(m, x + w / 2, 9, w, 8, 1 + Math.floor(r() * 3), -1, r, colliders, lamps);
      x += w;
    }
  }
  // Laterales de la plaza (fachadas mirando al centro)
  for (const side of [-1, 1] as const) {
    let z = 13;
    while (z < 26) {
      const dd = Math.min(5 + Math.floor(r() * 3), 26 - z);
      const cx = side * 16;
      const cz = z + dd / 2;
      const floors = 1 + Math.floor(r() * 2);
      const h = floors * 3 + 0.4;
      const shutter = SHUTTERS[Math.floor(r() * 4)];
      m.add(G.box, WHITE[Math.floor(r() * 4)], cx, h / 2, cz, 0, 0, 0, 8, h, dd);
      m.add(ROOF_GEO, ROOF, cx, h, cz, 0, Math.PI / 2, 0, dd + 0.1, 1.5, 8.5);
      const fx = cx - side * 4.06;
      for (let f = 0; f < floors; f++) {
        m.add(G.box, 0xffffff, fx + side * 0.02, f * 3 + 1.6, cz, 0, 0, 0, 0.08, 1.58, 1.38);
        m.add(G.box, shutter, fx, f * 3 + 1.6, cz - 0.31, 0, 0, 0, 0.08, 1.42, 0.58);
        m.add(G.box, shutter, fx, f * 3 + 1.6, cz + 0.31, 0, 0, 0, 0.08, 1.42, 0.58);
        m.add(G.cyl, 0xb5603b, fx - side * 0.15, f * 3 + 0.95, cz, 0, 0, 0, 0.3, 0.26, 0.3);
        m.add(G.sphere, FLOWERS[Math.floor(r() * 4)], fx - side * 0.15, f * 3 + 1.18, cz, 0, 0, 0, 0.4, 0.28, 0.4);
      }
      colliders.push({ minX: cx - 4, maxX: cx + 4, minZ: z, maxZ: z + dd });
      z += dd;
    }
  }

  // Iglesia de Sant Bartomeu al fondo de la plaza
  m.add(G.box, 0xe6d3ad, 0, 5, 30, 0, 0, 0, 14, 10, 8);
  m.add(ROOF_GEO, 0xa9573a, 0, 10, 30, 0, Math.PI / 2, 0, 8.4, 3, 14.4);
  for (const sx of [-7, 7]) m.add(G.box, 0xd8c39a, sx, 5, 26.2, 0, 0, 0, 0.8, 10, 0.6);
  m.add(G.box, 0xe0cba2, 5.5, 9, 26.5, 0, 0, 0, 3, 18, 3); // campanario
  m.add(G.box, 0x3b2a20, 5.5, 15.2, 24.98, 0, 0, 0, 1.4, 2.2, 0.06);
  m.add(G.cone, 0xd9a83a, 5.5, 15.0, 25.2, 0, 0, 0, 0.8, 0.9, 0.8); // campana
  m.add(G.cone, 0xa9573a, 5.5, 19, 26.5, 0, Math.PI / 4, 0, 3.8, 2.6, 3.8);
  m.add(G.box, 0xd8c39a, 0, 2.2, 25.98, 0, 0, 0, 3.4, 4.6, 0.1); // portal
  m.add(G.box, 0x6b4428, 0, 2, 25.9, 0, 0, 0, 2.4, 4, 0.1);
  m.add(G.cyl, 0xd8c39a, 0, 4.1, 25.92, Math.PI / 2, 0, 0, 2.4, 0.1, 2.4);
  m.add(G.cyl, 0x6b4428, 0, 4.1, 25.88, Math.PI / 2, 0, 0, 2.0, 0.1, 2.0);
  m.add(G.cyl, 0xd8c39a, 0, 7.4, 25.95, Math.PI / 2, 0, 0, 2.8, 0.1, 2.8); // rosetón
  m.add(G.cyl, 0x8fb3d9, 0, 7.4, 25.9, Math.PI / 2, 0, 0, 2.2, 0.1, 2.2);
  for (let k = 0; k < 8; k++) m.add(G.box, 0xd8c39a, 0, 7.4, 25.86, 0, 0, (k * Math.PI) / 8, 0.1, 2.2, 0.05);
  for (let k = 0; k < 3; k++) m.add(G.box, 0xcab58e, 0, 0.1 + k * 0.2, 25.3 - k * 0.4, 0, 0, 0, 6 - k, 0.2, 1.2); // escalones
  colliders.push({ minX: -7, maxX: 7, minZ: 26, maxZ: 34 }, { minX: 4, maxX: 7, minZ: 25, maxZ: 28 });

  // Vallas al final de la calle
  for (const ex of [-46, 46]) {
    for (let z = -4.5; z <= 4.5; z += 1.5) {
      m.add(G.box, 0x3a6ab0, ex, 0.6, z, 0, 0, 0, 0.1, 0.9, 1.4);
      m.add(G.box, 0xffffff, ex, 0.6, z, 0, 0, 0, 0.12, 0.2, 1.4);
    }
  }

  // Bares
  bar(m, 9, 8, 1, 0x2a7a50, colliders, 'Bar Es Pla', signs);
  bar(m, -28, -3.6, 1, 0xc23b3b, colliders, 'Cas Ferrer', signs);
  bar(m, 30, 3.6, -1, 0x2f5fb3, colliders, 'Sa Penya', signs);
  const tables: [number, number][] = [[7.5, 18], [-6, 18], [-24, -1.5], [33, 1.2], [-9, 7], [-31, -1.4], [27, 1.3]];
  tables.forEach(([tx, tz]) => table(m, tx, tz, colliders, r));

  // Pinos en la plaza y bancos
  for (const [px, pz] of [[-8, 21], [8.5, 23]]) {
    m.add(G.cyl, 0x6b4a30, px, 1.8, pz, 0, 0, 0.05, 0.5, 3.6, 0.5);
    m.add(G.sphere, 0x3d6b3a, px, 4.5, pz, 0, 0, 0, 4.4, 2.2, 4.4);
    m.add(G.sphere, 0x4a7d44, px + 0.6, 5.3, pz - 0.4, 0, 0, 0, 3, 1.6, 3);
    m.add(G.cyl, 0xd8c39a, px, 0.25, pz, 0, 0, 0, 1.6, 0.5, 1.6);
    colliders.push({ minX: px - 0.8, maxX: px + 0.8, minZ: pz - 0.8, maxZ: pz + 0.8 });
  }
  for (const bz of [9.5, 15]) {
    for (const sx of [-1, 1]) {
      const bx = sx * 11.2;
      m.add(G.box, 0x8a5a36, bx, 0.45, bz, 0, 0, 0, 0.5, 0.08, 2);
      m.add(G.box, 0x8a5a36, bx + sx * 0.22, 0.75, bz, 0, 0, 0, 0.06, 0.5, 2);
      m.add(G.box, 0x333333, bx, 0.22, bz - 0.8, 0, 0, 0, 0.45, 0.45, 0.06);
      m.add(G.box, 0x333333, bx, 0.22, bz + 0.8, 0, 0, 0, 0.45, 0.45, 0.06);
    }
  }
  // Arena en la plaza, donde saltan los ases
  const sand = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), toon({ color: 0xe2c48e }));
  sand.scale.set(8, 1, 6.8);
  sand.position.set(0, 0.015, 14);
  sand.userData.noCast = true;
  group.add(sand);

  // Banderines y bombillas cruzando la calle y la plaza
  const flagGeo = new THREE.ConeGeometry(0.25, 0.5, 3);
  const flagColors = [0xd7263d, 0xf4d35e, 0x1b998b, 0xffffff, 0x2e86ab];
  const lightPts: number[] = [];
  const strings: [number, number, number, number][] = [];
  for (let sx = -40; sx <= 40; sx += 8) if (Math.abs(sx) > 12) strings.push([sx, -5, sx, 5]);
  for (let sz = 8; sz <= 22; sz += 7) strings.push([-12, sz, 12, sz]);
  strings.push([-12, 4, 12, 24], [12, 4, -12, 24]);
  for (const [x1, z1, x2, z2] of strings) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.floor(len / 0.7);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const px = x1 + (x2 - x1) * t;
      const pz = z1 + (z2 - z1) * t;
      const py = 6.2 - Math.sin(t * Math.PI) * 1.3;
      if (i % 2) m.add(flagGeo, flagColors[i % flagColors.length], px, py - 0.25, pz, Math.PI, Math.atan2(x2 - x1, z2 - z1), 0);
      else lightPts.push(px, py - 0.1, pz);
    }
  }
  for (const l of lamps) lightPts.push(l.p.x, l.p.y, l.p.z);
  group.add(m.mesh());
  signs.forEach((s) => group.add(s));

  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lightPts, 3));
  const lights = new THREE.Points(lg, new THREE.PointsMaterial({ map: glowTexture(), color: 0xffd98a, size: 0.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(lights);

  // Multitud (4 variantes instanciadas). Evitamos el círculo central donde van los ases.
  const looks: PersonLook[] = [
    { skin: 0xe8b894, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x2b1d14, hairStyle: 'short' },
    { skin: 0xd9a27c, shirt: 0xd7263d, pants: 0x222222, hair: 0x5a3a22, hairStyle: 'long', skirt: true },
    { skin: 0xf0c8a6, shirt: 0x1b998b, pants: 0xe8e0d0, hair: 0xb07a3a, hairStyle: 'cap' },
    { skin: 0xc98e64, shirt: 0xf4d35e, pants: 0x3b4a6b, hair: 0x111111, hairStyle: 'pony', skirt: true },
  ];
  const spots: { x: number; z: number; ry: number }[] = [];
  const near = (px: number, pz: number, cx: number, cz: number, rr: number) => Math.hypot(px - cx, pz - cz) < rr;
  for (let i = 0; i < 600 && spots.length < 110; i++) {
    let px: number, pz: number;
    if (r() < 0.55) {
      const a = r() * Math.PI * 2;
      const rad = 9 + r() * 2.2;
      px = Math.cos(a) * rad;
      pz = 14 + Math.sin(a) * rad * 0.85;
    } else {
      px = -44 + r() * 88;
      pz = r() < 0.5 ? -4.3 + r() * 0.6 : 3.7 + r() * 0.6;
    }
    const bad =
      colliders.some((c) => px > c.minX - 0.6 && px < c.maxX + 0.6 && pz > c.minZ - 0.6 && pz < c.maxZ + 0.6) ||
      near(px, pz, 0, 14, 8) ||
      near(px, pz, 1.5, 22, 2.5) ||
      near(px, pz, 9, 9.5, 2.5) ||
      spots.some((s) => near(px, pz, s.x, s.z, 1.0));
    if (!bad) spots.push({ x: px, z: pz, ry: pz > 5 ? Math.atan2(0 - px, 14 - pz) : (pz < 0 ? 0 : Math.PI) + (r() - 0.5) });
  }
  const crowds: Crowd[] = looks.map((look, li) => {
    const mine = spots.filter((_, i) => i % looks.length === li);
    const mesh = new THREE.InstancedMesh(personGeometry(look, li % 2 === 1), vertexMat, mine.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    return { mesh, base: mine.map((s) => ({ ...s, phase: r() * 6, speed: 6 + r() * 4 })) };
  });

  scene.add(group);
  return {
    group,
    colliders,
    bounds: { minX: -45, maxX: 45, minZ: -4.6, maxZ: 25 },
    spawn: new THREE.Vector3(-38, 0, 0),
    pomadaSpots: [new THREE.Vector3(-24, 0.82, -1.5), new THREE.Vector3(33, 0.82, 1.2), new THREE.Vector3(-6, 0.82, 18)],
    tofolPos: new THREE.Vector3(9, 0, 7),
    marcPos: new THREE.Vector3(1.5, 0, 22),
    plazaCenter: new THREE.Vector3(0, 0, 14),
    crowds,
    lights,
    sky,
    sun,
  };
}

const tm = new THREE.Matrix4();
const tq = new THREE.Quaternion();
const tv = new THREE.Vector3();
const ts = new THREE.Vector3(1, 1, 1);
const up = new THREE.Vector3(0, 1, 0);
export function animateCrowd(crowds: Crowd[], t: number, energy = 1) {
  for (const c of crowds) {
    c.base.forEach((b, i) => {
      const bounce = Math.abs(Math.sin(t * b.speed * 0.5 + b.phase)) * 0.22 * energy;
      tq.setFromAxisAngle(up, b.ry + Math.sin(t * 1.5 + b.phase) * 0.35);
      tv.set(b.x, bounce, b.z);
      c.mesh.setMatrixAt(i, tm.compose(tv, tq, ts));
    });
    c.mesh.instanceMatrix.needsUpdate = true;
  }
}
