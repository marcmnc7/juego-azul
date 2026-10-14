import * as THREE from 'three';
import { G, Merger, personGeometry, vertexMat, PersonLook } from '../entities/models';

// Ferreries en fiestas: calle mayor de este a oeste, plaza con la iglesia al norte,
// casas encaladas con persianas verdes, banderines y bares llenos.

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
  lights: THREE.InstancedMesh;
}

// Prisma unitario para tejados a dos aguas: cumbrera a lo largo de X, base en y=0, altura 1.
const ROOF_GEO = (() => {
  const sh = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-0.5, 0, 0);
  return g;
})();

const WHITE = [0xf7f3ea, 0xf2ede2, 0xfaf7f0, 0xefe6d6];
const SHUTTER = 0x2f6b46;
const ROOF = 0xb5603b;

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#c9b79a';
  ctx.fillRect(0, 0, 256, 256);
  const r = rand(7);
  for (let y = 0; y < 256; y += 32) {
    for (let x = (y / 32) % 2 ? -16 : 0; x < 256; x += 32) {
      const v = 180 + Math.floor(r() * 30);
      ctx.fillStyle = `rgb(${v},${v - 14},${v - 36})`;
      ctx.fillRect(x + 2, y + 2, 28, 28);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function skyDome() {
  const geo = new THREE.SphereGeometry(400, 24, 12);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0x2b2a6b);
  const mid = new THREE.Color(0xe98a7d);
  const low = new THREE.Color(0xffc27a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 400;
    if (h > 0.25) c.copy(mid).lerp(top, Math.min(1, (h - 0.25) / 0.6));
    else c.copy(low).lerp(mid, Math.max(0, h / 0.25));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  return m;
}

/** Casa menorquina: blanca, persianas verdes, tejado de teja. `facing` = +1 si mira a +Z. */
function house(m: Merger, cx: number, cz: number, w: number, d: number, floors: number, facing: 1 | -1, r: () => number, colliders: Box2[]) {
  const h = floors * 3;
  const wall = WHITE[Math.floor(r() * WHITE.length)];
  m.add(G.box, wall, cx, h / 2, cz, 0, 0, 0, w, h, d);
  // Tejado a dos aguas (prisma)
  m.add(ROOF_GEO, ROOF, cx, h, cz, 0, 0, 0, w + 0.2, 1.6, d + 0.4);
  m.add(G.box, 0xd8cbb2, cx, 0.35, cz + facing * (d / 2 + 0.01), 0, 0, 0, w, 0.7, 0.04); // zócalo
  const fz = cz + facing * (d / 2 + 0.06);
  const cols = Math.max(1, Math.floor(w / 2.4));
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < cols; i++) {
      const x = cx - w / 2 + (w / cols) * (i + 0.5);
      const y = f * 3 + 1.6;
      if (f === 0 && i === Math.floor(cols / 2)) {
        m.add(G.box, 0x6b4428, x, 1.15, fz, 0, 0, 0, 1.1, 2.3, 0.1); // puerta
      } else {
        m.add(G.box, SHUTTER, x - 0.3, y, fz, 0, 0, 0, 0.55, 1.4, 0.1);
        m.add(G.box, SHUTTER, x + 0.3, y, fz, 0, 0, 0, 0.55, 1.4, 0.1);
        m.add(G.box, 0xffffff, x, y - 0.78, fz + facing * 0.05, 0, 0, 0, 1.4, 0.1, 0.25);
      }
    }
  }
  colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
}

function bar(m: Merger, x: number, z: number, facing: 1 | -1, awning: number, colliders: Box2[]) {
  // Toldo a rayas
  for (let i = 0; i < 6; i++) {
    m.add(G.box, i % 2 ? 0xffffff : awning, x - 2.5 + i + 0.5, 3.2, z - facing * 0.4, facing * 0.35, 0, 0, 1, 0.08, 2.2);
  }
  // Barra
  m.add(G.box, 0x8a5a36, x, 0.55, z, 0, 0, 0, 4, 1.1, 0.8);
  m.add(G.box, 0xd9c7a5, x, 1.13, z, 0, 0, 0, 4.2, 0.06, 1);
  colliders.push({ minX: x - 2, maxX: x + 2, minZ: z - 0.45, maxZ: z + 0.45 });
  // Botellas
  for (let i = 0; i < 6; i++) m.add(G.cyl, i % 2 ? 0x2f7d4a : 0x9fd3e8, x - 1.5 + i * 0.6, 1.35, z - facing * 0.2, 0, 0, 0, 0.12, 0.4, 0.12);
}

function table(m: Merger, x: number, z: number, colliders: Box2[]) {
  m.add(G.cyl, 0xeeeeee, x, 0.75, z, 0, 0, 0, 1.1, 0.05, 1.1);
  m.add(G.cyl, 0x777777, x, 0.37, z, 0, 0, 0, 0.08, 0.75, 0.08);
  for (const a of [0, Math.PI]) {
    m.add(G.box, 0xd2a15b, x + Math.cos(a) * 0.9, 0.45, z + Math.sin(a) * 0.9, 0, 0, 0, 0.45, 0.06, 0.45);
  }
  colliders.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.55, maxZ: z + 0.55 });
}

export function buildFerreries(scene: THREE.Scene): FerreriesWorld {
  const group = new THREE.Group();
  const colliders: Box2[] = [];
  const r = rand(42);

  scene.background = new THREE.Color(0xe98a7d);
  scene.fog = new THREE.Fog(0xe9a080, 30, 95);
  group.add(skyDome());

  const hemi = new THREE.HemisphereLight(0xfff0de, 0x7a6a86, 2.1);
  const sun = new THREE.DirectionalLight(0xffc48a, 1.6);
  sun.position.set(-30, 25, 10);
  group.add(hemi, sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const m = new Merger();

  // Calle mayor (z -5..5) y plaza (x -12..12, z 5..24)
  // Casas lado sur
  let x = -50;
  while (x < 50) {
    const w = 5 + Math.floor(r() * 4);
    house(m, x + w / 2, -9, w, 8, 1 + Math.floor(r() * 3), 1, r, colliders);
    x += w;
  }
  // Casas lado norte (hueco para la plaza)
  for (const [from, to] of [[-50, -12], [12, 50]]) {
    x = from;
    while (x < to) {
      const w = Math.min(to - x, 5 + Math.floor(r() * 4));
      house(m, x + w / 2, 9, w, 8, 1 + Math.floor(r() * 3), -1, r, colliders);
      x += w;
    }
  }
  // Laterales de la plaza
  for (const side of [-1, 1] as const) {
    let z = 13;
    while (z < 26) {
      const d = 5 + Math.floor(r() * 3);
      const dd = Math.min(d, 26 - z);
      // Rotamos las casas de la plaza: fachada mirando al centro (eje X)
      const cx = side * 16;
      const cz = z + dd / 2;
      const h = (1 + Math.floor(r() * 2)) * 3;
      m.add(G.box, WHITE[Math.floor(r() * 4)], cx, h / 2, cz, 0, 0, 0, 8, h, dd);
      m.add(ROOF_GEO, ROOF, cx, h, cz, 0, Math.PI / 2, 0, dd + 0.1, 1.6, 8.4);
      for (let f = 0; f < h / 3; f++) {
        m.add(G.box, SHUTTER, cx - side * 4.06, f * 3 + 1.6, cz - 0.3, 0, 0, 0, 0.1, 1.4, 0.55);
        m.add(G.box, SHUTTER, cx - side * 4.06, f * 3 + 1.6, cz + 0.3, 0, 0, 0, 0.1, 1.4, 0.55);
      }
      colliders.push({ minX: cx - 4, maxX: cx + 4, minZ: z, maxZ: z + dd });
      z += dd;
    }
  }

  // Iglesia de Sant Bartomeu al fondo de la plaza
  m.add(G.box, 0xe6d3ad, 0, 5, 30, 0, 0, 0, 14, 10, 8);
  m.add(ROOF_GEO, 0xa9573a, 0, 10, 30, 0, Math.PI / 2, 0, 8.4, 3, 14.4);
  m.add(G.box, 0xe0cba2, 5.5, 9, 26.5, 0, 0, 0, 3, 18, 3); // campanario
  m.add(G.box, 0x3b2a20, 5.5, 15.5, 25, 0, 0, 0, 1.2, 2, 0.1);
  m.add(G.cone, 0xa9573a, 5.5, 19, 26.5, 0, Math.PI / 4, 0, 3.6, 2.4, 3.6);
  m.add(G.box, 0x6b4428, 0, 2, 25.95, 0, 0, 0, 2.6, 4, 0.1); // portal
  m.add(G.cyl, 0x8fb3d9, 0, 7, 25.95, Math.PI / 2, 0, 0, 2.4, 0.1, 2.4); // rosetón
  colliders.push({ minX: -7, maxX: 7, minZ: 26, maxZ: 34 }, { minX: 4, maxX: 7, minZ: 25, maxZ: 28 });

  // Vallas al final de la calle
  for (const ex of [-46, 46]) {
    for (let z = -4.5; z <= 4.5; z += 1.5) m.add(G.box, 0x3a6ab0, ex, 0.55, z, 0, 0, 0, 0.12, 1.1, 1.4);
  }

  // Bares (Tòfol en la plaza, otros dos en la calle)
  bar(m, 9, 8, 1, 0x2a7a50, colliders); // Bar Es Pla (Tòfol)
  bar(m, -28, -3.6, 1, 0xc23b3b, colliders);
  bar(m, 30, 3.6, -1, 0x2f5fb3, colliders);
  const tables: [number, number][] = [[7.5, 18], [-6, 18], [-24, -1.5], [33, 1.2], [-9, 7]];
  tables.forEach(([tx, tz]) => table(m, tx, tz, colliders));

  // Pino solitario en la plaza
  m.add(G.cyl, 0x6b4a30, -8, 1.6, 21, 0, 0, 0, 0.5, 3.2, 0.5);
  m.add(G.sphere, 0x3d6b3a, -8, 4.2, 21, 0, 0, 0, 4, 2.4, 4);
  colliders.push({ minX: -8.4, maxX: -7.6, minZ: 20.6, maxZ: 21.4 });

  // Banderines cruzando la calle y la plaza
  const flagGeo = new THREE.ConeGeometry(0.25, 0.5, 3);
  const flagColors = [0xd7263d, 0xf4d35e, 0x1b998b, 0xffffff, 0x2e86ab];
  const lightPts: THREE.Vector3[] = [];
  const strings: [number, number, number, number][] = [];
  for (let sx = -40; sx <= 40; sx += 10) if (Math.abs(sx) > 12) strings.push([sx, -5, sx, 5]);
  for (let sz = 8; sz <= 22; sz += 7) strings.push([-12, sz, 12, sz]);
  strings.push([-12, 4, 12, 24], [12, 4, -12, 24]);
  for (const [x1, z1, x2, z2] of strings) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.floor(len / 0.8);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const px = x1 + (x2 - x1) * t;
      const pz = z1 + (z2 - z1) * t;
      const py = 6 - Math.sin(t * Math.PI) * 1.2;
      if (i % 2) m.add(flagGeo, flagColors[i % flagColors.length], px, py - 0.25, pz, Math.PI, Math.atan2(x2 - x1, z2 - z1), 0);
      else lightPts.push(new THREE.Vector3(px, py - 0.1, pz));
    }
  }
  group.add(m.mesh());

  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff1a8 }), lightPts.length);
  const tmp = new THREE.Matrix4();
  lightPts.forEach((p, i) => lights.setMatrixAt(i, tmp.makeTranslation(p.x, p.y, p.z)));
  group.add(lights);

  // Multitud (3 variantes instanciadas). Evitamos el círculo central donde van los ases.
  const looks: PersonLook[] = [
    { skin: 0xe8b894, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x2b1d14, hairStyle: 'short' },
    { skin: 0xd9a27c, shirt: 0xd7263d, pants: 0x222222, hair: 0x5a3a22, hairStyle: 'long', skirt: true },
    { skin: 0xf0c8a6, shirt: 0x1b998b, pants: 0xe8e0d0, hair: 0xb07a3a, hairStyle: 'cap' },
  ];
  const spots: { x: number; z: number; ry: number }[] = [];
  const near = (px: number, pz: number, cx: number, cz: number, rr: number) => Math.hypot(px - cx, pz - cz) < rr;
  for (let i = 0; i < 400 && spots.length < 84; i++) {
    let px: number, pz: number;
    if (r() < 0.55) {
      // Alrededor de la plaza
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
      near(px, pz, 0, 20, 2.5) ||
      near(px, pz, 9, 9.5, 2.5) ||
      spots.some((s) => near(px, pz, s.x, s.z, 1.1));
    if (!bad) spots.push({ x: px, z: pz, ry: Math.atan2(0 - px, 14 - pz) });
  }
  const crowds: Crowd[] = looks.map((look, li) => {
    const mine = spots.filter((_, i) => i % looks.length === li);
    const mesh = new THREE.InstancedMesh(personGeometry(look, li === 1), vertexMat, mine.length);
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
  };
}

const tm = new THREE.Matrix4();
const tq = new THREE.Quaternion();
const tv = new THREE.Vector3();
const ts = new THREE.Vector3(1, 1, 1);
const up = new THREE.Vector3(0, 1, 0);
export function animateCrowd(crowds: Crowd[], t: number) {
  for (const c of crowds) {
    c.base.forEach((b, i) => {
      const bounce = Math.abs(Math.sin(t * b.speed * 0.5 + b.phase)) * 0.25;
      tq.setFromAxisAngle(up, b.ry + Math.sin(t * 1.5 + b.phase) * 0.4);
      tv.set(b.x, bounce, b.z);
      c.mesh.setMatrixAt(i, tm.compose(tv, tq, ts));
    });
    c.mesh.instanceMatrix.needsUpdate = true;
  }
}
