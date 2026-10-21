import * as THREE from 'three';
import { G, Merger, personGeometry, vertexMat, PersonLook } from '../entities/models';
import { Sky, Sun, toon, glowTexture } from '../core/gfx';
import type { Circle } from '../core/walker';
import { menorcaFlagTexture, senyeraTexture, bannerTexture, streetSignTexture, letteringTexture, mergedPlanes } from './deco';

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
  /** Bailarines de los bares: segunda postura que se alterna con la primera. */
  alt?: THREE.InstancedMesh;
}

/** Sitio de un balcón donde colgar una bandera. */
interface Hang {
  x: number;
  y: number;
  z: number;
  facing: 1 | -1;
}

/** Carteles del pueblo, para reutilizar las calles en otras fiestas (Sant Joan en Ciutadella). */
export interface TownDressing {
  banner: [string[], string];
  signs: [string, string];
  bars?: [string, string, string, string];
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
  /** Gente del público como obstáculos redondos. */
  people: Circle[];
  lights: THREE.Points;
  /** Luces de colores de los bares (parpadean con la música). */
  partyLights: THREE.Points;
  /** Delante de cada barra: de ahí salen las notas musicales. */
  bars: THREE.Vector3[];
  fabioleraPos: THREE.Vector3;
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
function house(m: Merger, cx: number, cz: number, w: number, d: number, floors: number, facing: 1 | -1, r: () => number, colliders: Box2[], lamps: Lamp[], hangs: Hang[]) {
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
          hangs.push({ x, y: y - 0.2, z: fz + facing * 0.8, facing });
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
  colliders.push({ minX: x - 2, maxX: x + 3.05, minZ: z - 0.45, maxZ: z + 0.45 });
  // Postes del toldo
  for (const sx of [-3, 3]) colliders.push({ minX: x + sx - 0.12, maxX: x + sx + 0.12, minZ: z + facing * 0.85 - 0.12, maxZ: z + facing * 0.85 + 0.12 });
  // Botellas y vasos
  for (let i = 0; i < 7; i++) m.add(G.cyl, [0x2f7d4a, 0x9fd3e8, 0xe9e2b8][i % 3], x - 1.6 + i * 0.52, 1.36, z - facing * 0.25, 0, 0, 0, 0.11, 0.42, 0.11);
  for (let i = 0; i < 4; i++) m.add(G.cyl, 0xfff4b0, x - 1 + i * 0.6, 1.24, z + facing * 0.2, 0, 0, 0, 0.12, 0.18, 0.12);
  // Botella de gin de Menorca con su asa, para las pomadas
  m.add(G.cyl, 0x9fc9b0, x + 1.6, 1.45, z + facing * 0.15, 0, 0, 0, 0.26, 0.6, 0.26);
  m.add(G.cyl, 0x9fc9b0, x + 1.6, 1.85, z + facing * 0.15, 0, 0, 0, 0.1, 0.25, 0.1);
  m.add(G.smile, 0x9fc9b0, x + 1.75, 1.6, z + facing * 0.15, 0, 0, Math.PI / 2, 0.22, 0.22, 0.3);
  m.add(G.box, 0xf4efe2, x + 1.6, 1.45, z + facing * 0.29, 0, 0, 0, 0.18, 0.2, 0.01);
  // Altavoz para la música del bar
  m.add(G.box, 0x222228, x - 3.6, 0.7, z, 0, 0, 0, 0.7, 1.4, 0.6);
  m.add(G.cyl, 0x555560, x - 3.6, 0.9, z + facing * 0.31, Math.PI / 2, 0, 0, 0.45, 0.02, 0.45);
  m.add(G.cyl, 0x555560, x - 3.6, 0.4, z + facing * 0.31, Math.PI / 2, 0, 0, 0.25, 0.02, 0.25);
  colliders.push({ minX: x - 3.95, maxX: x - 3.25, minZ: z - 0.3, maxZ: z + 0.3 });
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
  // Mesa y las dos sillas a los lados
  colliders.push({ minX: x - 1.2, maxX: x + 1.2, minZ: z - 0.55, maxZ: z + 0.55 });
}

const MARC = new THREE.Vector3(-5.2, 0, 21.6);

export function buildFerreries(scene: THREE.Scene, town?: TownDressing): FerreriesWorld {
  const group = new THREE.Group();
  const colliders: Box2[] = [];
  const lamps: Lamp[] = [];
  const signs: THREE.Object3D[] = [];
  const hangs: Hang[] = [];
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
    house(m, x + w / 2, -9, w, 8, 1 + Math.floor(r() * 3), 1, r, colliders, lamps, hangs);
    x += w;
  }
  for (const [from, to] of [[-50, -12], [12, 50]]) {
    x = from;
    while (x < to) {
      const w = Math.min(to - x, 5 + Math.floor(r() * 4));
      house(m, x + w / 2, 9, w, 8, 1 + Math.floor(r() * 3), -1, r, colliders, lamps, hangs);
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

  // Iglesia de Sant Bartomeu al fondo del Pla de l'Església: fachada con frontón y rosetón,
  // y el campanario a la derecha con arcos, reloj y remate piramidal con cruz.
  const STONE = 0xe6d3ad;
  m.add(G.box, STONE, 0, 5, 30, 0, 0, 0, 14, 10, 8);
  m.add(ROOF_GEO, 0xa9573a, 0, 10, 30, 0, Math.PI / 2, 0, 8.4, 3, 14.4);
  m.add(ROOF_GEO, STONE, 0, 10, 26.1, 0, 0, 0, 14.2, 3.2, 0.3); // frontón
  m.add(G.box, 0xd8c39a, 0, 10.05, 25.95, 0, 0, 0, 14.4, 0.3, 0.4); // cornisa
  for (const sx of [-7, 7]) m.add(G.box, 0xd8c39a, sx, 5, 26.2, 0, 0, 0, 0.8, 10, 0.6);
  for (const sx of [-3.6, 3.6]) m.add(G.box, 0xdcc79f, sx, 5, 26.0, 0, 0, 0, 0.5, 10, 0.3); // pilastras
  m.add(G.box, 0xd8c39a, 0, 13.4, 26.0, 0, 0, 0, 0.15, 1.2, 0.15); // cruz del frontón
  m.add(G.box, 0xd8c39a, 0, 13.6, 26.0, 0, 0, 0, 0.7, 0.15, 0.15);
  // Campanario
  const TX = 8.6;
  const TZ = 27.4;
  m.add(G.box, 0xe0cba2, TX, 8, TZ, 0, 0, 0, 3.6, 16, 3.6);
  for (const y of [5.3, 10.6]) m.add(G.box, 0xd8c39a, TX, y, TZ, 0, 0, 0, 3.9, 0.3, 3.9); // impostas
  m.add(G.box, 0xd8c39a, TX, 16.15, TZ, 0, 0, 0, 4.1, 0.35, 4.1);
  m.add(G.box, 0xe0cba2, TX, 18, TZ, 0, 0, 0, 3.2, 3.4, 3.2); // cuerpo de campanas
  for (const [dx, dz, ry] of [[0, -1.61, 0], [0, 1.61, 0], [-1.61, 0, Math.PI / 2], [1.61, 0, Math.PI / 2]]) {
    m.add(G.box, 0x2a1d16, TX + dx, 17.8, TZ + dz, 0, ry, 0, 1.3, 2.2, 0.06); // hueco
    m.add(G.cyl, 0x2a1d16, TX + dx, 18.9, TZ + dz, Math.PI / 2, ry, 0, 1.3, 0.06, 1.3); // arco
  }
  m.add(G.cone, 0xd9a83a, TX, 17.5, TZ - 1.0, 0, 0, 0, 0.9, 1.0, 0.9); // campana
  m.add(G.box, 0xd8c39a, TX, 19.85, TZ, 0, 0, 0, 3.6, 0.3, 3.6);
  m.add(G.cone, 0xb86a42, TX, 21.2, TZ, 0, Math.PI / 4, 0, 3.6, 2.5, 3.6); // chapitel
  m.add(G.box, 0x444444, TX, 23.1, TZ, 0, 0, 0, 0.1, 1.4, 0.1);
  m.add(G.box, 0x444444, TX, 23.3, TZ, 0, 0, 0, 0.7, 0.1, 0.1);
  m.add(G.cyl, 0xfbf7ee, TX, 13.2, TZ - 1.82, Math.PI / 2, 0, 0, 1.8, 0.08, 1.8); // reloj
  m.add(G.cyl, 0x2a1d16, TX, 13.2, TZ - 1.88, Math.PI / 2, 0, 0, 0.2, 0.05, 0.2);
  m.add(G.box, 0x2a1d16, TX, 13.45, TZ - 1.9, 0, 0, 0, 0.06, 0.55, 0.03);
  m.add(G.box, 0x2a1d16, TX + 0.17, 13.2, TZ - 1.9, 0, 0, 0, 0.38, 0.06, 0.03);
  colliders.push({ minX: TX - 1.8, maxX: TX + 1.8, minZ: TZ - 1.8, maxZ: TZ + 1.8 });
  m.add(G.box, 0xd8c39a, 0, 2.2, 25.98, 0, 0, 0, 3.4, 4.6, 0.1); // portal
  m.add(G.box, 0x6b4428, 0, 2, 25.9, 0, 0, 0, 2.4, 4, 0.1);
  m.add(G.cyl, 0xd8c39a, 0, 4.1, 25.92, Math.PI / 2, 0, 0, 2.4, 0.1, 2.4);
  m.add(G.cyl, 0x6b4428, 0, 4.1, 25.88, Math.PI / 2, 0, 0, 2.0, 0.1, 2.0);
  m.add(G.cyl, 0xd8c39a, 0, 7.4, 25.95, Math.PI / 2, 0, 0, 2.8, 0.1, 2.8); // rosetón
  m.add(G.cyl, 0x8fb3d9, 0, 7.4, 25.9, Math.PI / 2, 0, 0, 2.2, 0.1, 2.2);
  for (let k = 0; k < 8; k++) m.add(G.box, 0xd8c39a, 0, 7.4, 25.86, 0, 0, (k * Math.PI) / 8, 0.1, 2.2, 0.05);
  for (let k = 0; k < 3; k++) m.add(G.box, 0xcab58e, 0, 0.1 + k * 0.2, 25.3 - k * 0.4, 0, 0, 0, 6 - k, 0.2, 1.2); // escalones
  colliders.push({ minX: -7, maxX: 7, minZ: 26, maxZ: 34 });

  // Vallas al final de la calle
  for (const ex of [-46, 46]) {
    for (let z = -4.5; z <= 4.5; z += 1.5) {
      m.add(G.box, 0x3a6ab0, ex, 0.6, z, 0, 0, 0, 0.1, 0.9, 1.4);
      m.add(G.box, 0xffffff, ex, 0.6, z, 0, 0, 0, 0.12, 0.2, 1.4);
    }
  }

  // Bares
  bar(m, 9, 8, 1, 0x2a7a50, colliders, town?.bars?.[0] ?? 'Bar Es Pla', signs);
  bar(m, -28, -3.6, 1, 0xc23b3b, colliders, town?.bars?.[1] ?? 'Cas Ferrer', signs);
  bar(m, 30, 3.6, -1, 0x2f5fb3, colliders, town?.bars?.[2] ?? 'Sa Penya', signs);
  bar(m, -7.5, 24.2, -1, 0x7a3fa0, colliders, town?.bars?.[3] ?? 'Bar Sa Plaça', signs);
  const barFronts = [new THREE.Vector3(9, 0, 10.2), new THREE.Vector3(-28, 0, -1.6), new THREE.Vector3(30, 0, 1.6), new THREE.Vector3(-7.5, 0, 22.2)];
  const tables: [number, number][] = [[7.5, 18], [-6, 18], [-24, -1.5], [33, 1.2], [-9, 7], [-31, -1.4], [27, 1.3]];
  tables.forEach(([tx, tz]) => table(m, tx, tz, colliders, r));

  // Pinos en la plaza y bancos
  for (const [px, pz] of [[-10.6, 20.4], [8.5, 23]]) {
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
      colliders.push({ minX: bx - 0.3, maxX: bx + 0.3, minZ: bz - 1, maxZ: bz + 1 });
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

  // ---- Ambiente de Sant Bartomeu ----
  // Banderas de Menorca y senyeres colgando de los balcones
  const flagMat = (tex: THREE.Texture) => toon({ map: tex, side: THREE.DoubleSide });
  const menorcaPlanes: Parameters<typeof mergedPlanes>[0] = [];
  const senyeraPlanes: Parameters<typeof mergedPlanes>[0] = [];
  hangs.forEach((h, i) => {
    if (i % 3 === 2) return;
    const ry = h.facing > 0 ? 0 : Math.PI;
    if (i % 3 === 0) menorcaPlanes.push({ w: 1.5, h: 1.0, x: h.x, y: h.y - 0.6, z: h.z + h.facing * 0.03, ry });
    else senyeraPlanes.push({ w: 0.9, h: 1.35, x: h.x, y: h.y - 0.75, z: h.z + h.facing * 0.03, ry });
  });
  const menorcaMat = flagMat(menorcaFlagTexture());
  const senyeraMat = flagMat(senyeraTexture());
  if (menorcaPlanes.length) group.add(mergedPlanes(menorcaPlanes, menorcaMat));
  if (senyeraPlanes.length) group.add(mergedPlanes(senyeraPlanes, senyeraMat));

  // Pancartas de las fiestas cruzando la calle y a la entrada del Pla de l'Església
  const bannerMat = toon({ map: (town ? bannerTexture(...town.banner) : bannerTexture(["Festes de Sant Bartomeu", 'Ferreries · Menorca'], "Jaleo d'Ases · 23, 24 i 25 d'agost")) });
  const banners: Parameters<typeof mergedPlanes>[0] = [];
  for (const bx of [-34, 22]) {
    banners.push({ w: 8, h: 2, x: bx, y: 5.3, z: 0, ry: -Math.PI / 2 }, { w: 8, h: 2, x: bx + 0.03, y: 5.3, z: 0, ry: Math.PI / 2 });
    m.add(G.box, 0x6b5a4a, bx, 6.35, 0, 0, 0, 0, 0.04, 0.04, 10);
  }
  banners.push({ w: 9, h: 2.25, x: 0, y: 5.6, z: 5.4, ry: Math.PI }, { w: 9, h: 2.25, x: 0, y: 5.6, z: 5.43, ry: 0 });
  m.add(G.box, 0x6b5a4a, 0, 6.75, 5.4, 0, 0, 0, 24, 0.04, 0.04);
  group.add(mergedPlanes(banners, bannerMat));

  // Placas de calle
  const sign1 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.52), new THREE.MeshBasicMaterial({ map: streetSignTexture(town?.signs[0] ?? 'Carrer de Sant Bartomeu') }));
  sign1.position.set(-41, 3.2, -4.86);
  const sign2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.52), new THREE.MeshBasicMaterial({ map: streetSignTexture(town?.signs[1] ?? "Pla de l'Església") }));
  sign2.position.set(-11.86, 3.0, 14.6);
  sign2.rotation.y = Math.PI / 2;
  const sign3 = sign2.clone();
  sign3.position.set(-13.5, 3.2, 4.86);
  sign3.rotation.y = Math.PI;
  group.add(sign1, sign2, sign3);

  // Ajuntament de Ferreries en el lateral derecho de la plaza: soportales, balcón, banderas y reloj
  const AX = 11.7;
  m.add(G.box, 0xefe4cc, AX + 0.2, 4.1, 18, 0, 0, 0, 0.5, 8.2, 6.4);
  m.add(G.box, 0xd8c39a, AX - 0.06, 8.25, 18, 0, 0, 0, 0.6, 0.3, 6.8);
  m.add(ROOF_GEO, 0xd8c39a, AX, 8.4, 18, 0, Math.PI / 2, 0, 3, 1.2, 0.4); // frontón con el reloj
  m.add(G.cyl, 0xfbf7ee, AX - 0.08, 8.9, 18, 0, 0, Math.PI / 2, 0.75, 0.06, 0.75);
  m.add(G.box, 0x2a1d16, AX - 0.13, 9.0, 18, 0, 0, 0, 0.03, 0.3, 0.04);
  for (const az of [15.8, 18, 20.2]) {
    m.add(G.box, 0x3a2a20, AX - 0.06, 1.3, az, 0, 0, 0, 0.06, 2.6, 1.4); // arcos de los soportales
    m.add(G.cyl, 0x3a2a20, AX - 0.06, 2.6, az, 0, 0, Math.PI / 2, 1.4, 0.06, 1.4);
    m.add(G.box, 0xffffff, AX - 0.08, 5.3, az, 0, 0, 0, 0.06, 1.7, 1.2);
    m.add(G.box, 0x2f6b46, AX - 0.11, 5.3, az, 0, 0, 0, 0.04, 1.55, 1.05);
  }
  m.add(G.box, 0xe9dcc2, AX - 0.5, 4.2, 18, 0, 0, 0, 0.9, 0.12, 6); // balcón corrido
  for (let k = -14; k <= 14; k++) m.add(G.box, 0x222222, AX - 0.9, 4.55, 18 + k * 0.2, 0, 0, 0, 0.03, 0.6, 0.03);
  m.add(G.box, 0x222222, AX - 0.9, 4.85, 18, 0, 0, 0, 0.04, 0.04, 6);
  colliders.push({ minX: AX - 0.2, maxX: AX + 0.5, minZ: 14.8, maxZ: 21.2 });
  const ajLetters = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.55), new THREE.MeshBasicMaterial({ map: letteringTexture(town ? 'AJUNTAMENT DE CIUTADELLA' : 'AJUNTAMENT DE FERRERIES', '#5a3a22'), transparent: true }));
  ajLetters.position.set(AX - 0.1, 7.3, 18);
  ajLetters.rotation.y = -Math.PI / 2;
  group.add(ajLetters);
  // Mástiles inclinados con la bandera de Menorca y la senyera
  [[16.6, menorcaMat], [19.4, senyeraMat]].forEach(([fz, mat]) => {
    m.add(G.cyl, 0xd9b45a, AX - 1.5, 5.6, fz as number, 0, 0, 0.7, 0.05, 2.6, 0.05);
    const f = mergedPlanes([{ w: 1.3, h: 0.9, x: AX - 1.9, y: 6.1, z: fz as number, ry: -Math.PI / 2 }], mat as THREE.Material);
    group.add(f);
  });
  group.add(m.mesh());
  signs.forEach((s) => group.add(s));

  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lightPts, 3));
  const lights = new THREE.Points(lg, new THREE.PointsMaterial({ map: glowTexture(), color: 0xffd98a, size: 0.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(lights);

  // Guirnaldas de colores bajo los toldos de los bares
  const pp: number[] = [];
  const pc: number[] = [];
  const col = new THREE.Color();
  barFronts.forEach((b, bi) => {
    const facing = bi === 0 || bi === 1 ? 1 : -1;
    const bz = b.z - facing * 1.25; // borde del toldo
    for (let i = 0; i <= 14; i++) {
      pp.push(b.x - 3.2 + i * (6.4 / 14), 2.7 - Math.sin((i / 14) * Math.PI) * 0.25, bz);
      col.setHSL((i * 0.13 + bi * 0.3) % 1, 0.95, 0.6);
      pc.push(col.r, col.g, col.b);
    }
  });
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
  pg.setAttribute('color', new THREE.Float32BufferAttribute(pc, 3));
  const partyLights = new THREE.Points(pg, new THREE.PointsMaterial({ map: glowTexture(), vertexColors: true, size: 0.75, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(partyLights);

  // Multitud (4 variantes instanciadas). Evitamos el círculo central donde van los ases.
  const looks: PersonLook[] = [
    { skin: 0xe8b894, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x2b1d14, hairStyle: 'short' },
    { skin: 0xd9a27c, shirt: 0xd7263d, pants: 0x222222, hair: 0x5a3a22, hairStyle: 'long', skirt: true },
    { skin: 0xf0c8a6, shirt: 0x1b998b, pants: 0xe8e0d0, hair: 0xb07a3a, hairStyle: 'cap' },
    { skin: 0xc98e64, shirt: 0xf4d35e, pants: 0x3b4a6b, hair: 0x111111, hairStyle: 'pony', skirt: true },
  ];
  const spots: { x: number; z: number; ry: number }[] = [];
  const near = (px: number, pz: number, cx: number, cz: number, rr: number) => Math.hypot(px - cx, pz - cz) < rr;
  for (let i = 0; i < 600 && spots.length < 90; i++) {
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
      near(px, pz, MARC.x, MARC.z, 2.5) ||
      barFronts.some((b) => near(px, pz, b.x, b.z, 3.2)) ||
      near(px, pz, 9, 9.5, 2.5) ||
      spots.some((s) => near(px, pz, s.x, s.z, 1.0));
    if (!bad) spots.push({ x: px, z: pz, ry: pz > 5 ? Math.atan2(0 - px, 14 - pz) : (pz < 0 ? 0 : Math.PI) + (r() - 0.5) });
  }
  const crowds: Crowd[] = looks.map((look, li) => {
    const mine = spots.filter((_, i) => i % looks.length === li);
    const mesh = new THREE.InstancedMesh(personGeometry(look, li % 2 === 1), vertexMat(), mine.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    return { mesh, base: mine.map((s) => ({ ...s, phase: r() * 6, speed: 6 + r() * 4 })) };
  });

  // Gente bailando delante de cada bar (alternan brazos arriba y abajo al ritmo)
  const dancers: { x: number; z: number; ry: number }[] = [];
  const pomadaAt = [[-24, -1.5], [33, 1.2], [-6, 18]];
  barFronts.forEach((b, bi) => {
    const facing = bi === 0 || bi === 1 ? 1 : -1;
    for (let i = 0; i < 80 && dancers.filter((d) => near(d.x, d.z, b.x, b.z, 4)).length < 11; i++) {
      const px = b.x + (r() - 0.5) * 6.5;
      const pz = b.z + facing * (r() * 2.6 - 0.2);
      const bad =
        colliders.some((c) => px > c.minX - 0.5 && px < c.maxX + 0.5 && pz > c.minZ - 0.5 && pz < c.maxZ + 0.5) ||
        near(px, pz, MARC.x, MARC.z, 1.4) ||
        (bi === 3 && px > MARC.x - 0.6) ||
        near(px, pz, 9, 7, 2) ||
        pomadaAt.some(([qx, qz]) => near(px, pz, qx, qz, 2.2)) ||
        pz < -4.3 || pz > 24.5 ||
        [...spots, ...dancers].some((s) => near(px, pz, s.x, s.z, 0.95));
      if (!bad) dancers.push({ x: px, z: pz, ry: r() * Math.PI * 2 });
    }
  });
  const partyLooks: PersonLook[] = [
    { skin: 0xf0c8a6, shirt: 0xffffff, pants: 0x2b2b3a, hair: 0x6a4a2a, hairStyle: 'short' },
    { skin: 0xe8b894, shirt: 0xd7263d, pants: 0xffffff, hair: 0x2b1d14, hairStyle: 'long', skirt: true },
    { skin: 0xd9a27c, shirt: 0xf4d35e, pants: 0x2b2b3a, hair: 0x111111, hairStyle: 'bun', skirt: true },
  ];
  partyLooks.forEach((look, li) => {
    const mine = dancers.filter((_, i) => i % partyLooks.length === li);
    if (!mine.length) return;
    const up = new THREE.InstancedMesh(personGeometry(look, true), vertexMat(), mine.length);
    const down = new THREE.InstancedMesh(personGeometry(look, false), vertexMat(), mine.length);
    for (const im of [up, down]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(im);
    }
    crowds.push({ mesh: up, alt: down, base: mine.map((s) => ({ ...s, phase: r() * 6, speed: 9 + r() * 3 })) });
  });

  scene.add(group);
  return {
    group,
    colliders,
    bounds: { minX: -45, maxX: 45, minZ: -4.6, maxZ: 25 },
    spawn: new THREE.Vector3(-38, 0, 0),
    pomadaSpots: [new THREE.Vector3(-24, 0.82, -1.5), new THREE.Vector3(33, 0.82, 1.2), new THREE.Vector3(-6, 0.82, 18)],
    tofolPos: new THREE.Vector3(9, 0, 7),
    marcPos: MARC.clone(),
    plazaCenter: new THREE.Vector3(0, 0, 14),
    crowds,
    people: [...spots, ...dancers].map((s) => ({ x: s.x, z: s.z, r: 0.35 })),
    lights,
    partyLights,
    bars: barFronts,
    fabioleraPos: new THREE.Vector3(3.6, 0, 23.4),
    sky,
    sun,
  };
}

const tm = new THREE.Matrix4();
const tq = new THREE.Quaternion();
const tv = new THREE.Vector3();
const ts = new THREE.Vector3(1, 1, 1);
const zero = new THREE.Vector3(0.0001, 0.0001, 0.0001);
const up = new THREE.Vector3(0, 1, 0);
export function animateCrowd(crowds: Crowd[], t: number, energy = 1) {
  for (const c of crowds) {
    c.base.forEach((b, i) => {
      if (c.alt) {
        // Bailarines: saltan más, giran y alternan postura
        const ph = t * b.speed * 0.5 + b.phase;
        const bounce = Math.abs(Math.sin(ph)) * 0.35 * energy;
        tq.setFromAxisAngle(up, b.ry + Math.sin(t * 2 + b.phase) * 1.2);
        tv.set(b.x, bounce, b.z);
        const armsUp = Math.sin(ph * 0.5) > 0;
        c.mesh.setMatrixAt(i, tm.compose(tv, tq, armsUp ? ts : zero));
        c.alt.setMatrixAt(i, tm.compose(tv, tq, armsUp ? zero : ts));
        return;
      }
      const bounce = Math.abs(Math.sin(t * b.speed * 0.5 + b.phase)) * 0.22 * energy;
      tq.setFromAxisAngle(up, b.ry + Math.sin(t * 1.5 + b.phase) * 0.35);
      tv.set(b.x, bounce, b.z);
      c.mesh.setMatrixAt(i, tm.compose(tv, tq, ts));
    });
    c.mesh.instanceMatrix.needsUpdate = true;
    if (c.alt) c.alt.instanceMatrix.needsUpdate = true;
  }
}
