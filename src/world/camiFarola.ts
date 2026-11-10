import * as THREE from 'three';
import { G, Merger, makePerson, animatePerson, vertexMat, CarRig, type Person, type PersonLook } from '../entities/models';
import { seated } from '../entities/vehiclesHD';
import { Sky, Sun, glowTexture, applyShadows, settleAmbient, toon, paintMat } from '../core/gfx';
import { setSurface, Surf } from '../core/surfaces';
import { MARC_LOOK, MARGAUX_LOOK } from '../data/characters';
import { canvasTex, streetSignTexture } from './deco';

// Sant Joan, de madrugada: el taxi por el Camí de sa Farola, como en Street View. Asfalto con la línea discontinua,
// arcén de tierra roja, coches aparcados a los dos lados, pinos enormes que cierran la carretera por arriba, muro de
// piedra seca con sus cancelas, villas (casi todas ya a oscuras), farolas de hormigón y postes con el cable. Y gente
// que vuelve de la fiesta por el arcén.
//
// En tebeo (como el cap. 1 y el 2): superficies dibujadas (asfalto, tierra, piedra seca, corteza) en vez de fotos
// pintadas en lienzo, copas de pino macizas, la pintura de la calzada plana y ninguna lámpara que ilumine nada (ni
// farolas, ni faros): solo se ven encendidas.

const EARTH = 0x8a4f33;
setSurface(EARTH, Surf.Sand);
/** Suelo del pinar: tierra con pinaza. */
const FOREST = 0x5e5034;
setSurface(FOREST, Surf.Sand);
const LEN = 300;
/** Carril de la derecha, mirando hacia +z. */
const LANE_X = -1.75;
const FROM_Z = 8;
const TO_Z = 232;
const WALL_X = -7.3;

const TAXI_DRIVER: PersonLook = { skin: 0xe2b08c, shirt: 0xf2f2ee, pants: 0x2a2a2a, hair: 0x4a4a4a, hairStyle: 'short', male: true };

const ROAD_W = 15;

// ---------------- Pinos ----------------

/** Rama o tronco: un tubo con su curva y su grosor, con coordenadas de textura para la corteza. */
function tube(path: THREE.Vector3[], r0: number, r1: number) {
  const curve = new THREE.CatmullRomCurve3(path);
  const seg = Math.max(6, path.length * 3), rad = 9;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const fr = curve.computeFrenetFrames(seg, false);
  const len = curve.getLength();
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const p = curve.getPointAt(u);
    const r = THREE.MathUtils.lerp(r0, r1, u) * (1 + (i === 0 ? 0.26 : 0) + Math.sin(u * 19) * 0.035);
    for (let k = 0; k <= rad; k++) {
      const a = (k / rad) * Math.PI * 2;
      const nx = fr.normals[i].x * Math.cos(a) + fr.binormals[i].x * Math.sin(a);
      const ny = fr.normals[i].y * Math.cos(a) + fr.binormals[i].y * Math.sin(a);
      const nz = fr.normals[i].z * Math.cos(a) + fr.binormals[i].z * Math.sin(a);
      pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      uv.push((k / rad) * Math.max(1, Math.round(r * 5)), (u * len) / 0.95);
    }
  }
  for (let i = 0; i < seg; i++)
    for (let k = 0; k < rad; k++) {
      const a = i * (rad + 1) + k, b = a + rad + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

function concat(list: THREE.BufferGeometry[]) {
  const attrs = ['position', 'normal', 'uv', 'color'].filter((k) => list[0].attributes[k]);
  const total = list.reduce((a, g) => a + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const k of attrs) {
    const size = list[0].attributes[k].itemSize;
    const arr = new Float32Array(total * size);
    let o = 0;
    for (const g of list) {
      arr.set(g.attributes[k].array as Float32Array, o);
      o += g.attributes[k].count * size;
    }
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

/** Un pino piñonero de los de la foto: tronco enorme y torcido hacia la carretera (+x) y copa ancha y plana. */
function pine(variant: number) {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const lean = 1 + variant * 0.25;
  const top = v(2.6 * lean, 10.6, variant === 1 ? 0.9 : -0.5);
  const parts = [tube([v(0, -0.2, 0), v(0.12 * lean, 3, 0.1), v(0.7 * lean, 6.2, -0.1), v(1.6 * lean, 8.6, 0.2), top], 0.62, 0.3)];
  const tips: THREE.Vector3[] = [];
  const bs: [number, number, number][] = [[4.6, 1.3, 0.8], [2.5, 1.9, -3], [-2.6, 1.6, 2.6], [1.4, 1.1, 3.5], [-1.8, 2.4, -2.5]];
  for (const [dx, dy, dz] of bs) {
    const tip = top.clone().add(v(dx, dy, dz));
    parts.push(tube([top.clone().add(v(0, -0.4, 0)), top.clone().add(v(dx * 0.45, dy * 0.34 + 0.1, dz * 0.45)), tip], 0.2, 0.05));
    tips.push(tip);
  }
  // Ramas secas y muñones más abajo: el tronco no es un palo
  for (const [h, a, l] of [[4.4, 0.8, 1.5], [5.9, 3.6, 1.8], [7.3, 2.2, 1.4]]) {
    const b = v(0.14 * lean + (h > 6 ? 0.8 : 0.3) * lean, h, 0);
    parts.push(tube([b, b.clone().add(v(Math.cos(a) * l * 0.5, 0.3, Math.sin(a) * l * 0.5)), b.clone().add(v(Math.cos(a) * l, 0.25, Math.sin(a) * l))], 0.085, 0.015));
  }
  const trunk = concat(parts);
  // La copa: una seta ancha y plana de matas macizas (como las copas del cap. 1), más oscura por abajo. Las 170
  // láminas de agujas recortadas de antes llenaban la copa de tinta
  const crown = new Merger(false);
  tips.forEach((tip, i) => {
    crown.add(G.sphere, 0x24441f, tip.x, tip.y - 0.42, tip.z, 0, i, 0, 2.9, 0.75, 2.9);
    crown.add(G.sphere, i % 2 ? 0x2f5a28 : 0x335e2b, tip.x, tip.y, tip.z, 0, i * 2, 0, 3.4, 1.05, 3.4);
    crown.add(G.sphere, 0x3b6b30, tip.x + 0.3, tip.y + 0.42, tip.z - 0.2, 0, i, 0, 2.3, 0.6, 2.3);
  });
  return { trunk, crown: crown.build() };
}

// ---------------- Coches ----------------

type Stn = [number, number];
interface CarSpec {
  len: number;
  w: number;
  bot: number;
  /** Altura del capó y la cintura a lo largo del coche (z, y). */
  body: Stn[];
  /** Línea del techo a lo largo del coche. Sin ella, carrocería de furgoneta. */
  cabin?: Stn[];
  /** Tramo del techo pintado. */
  roof?: [number, number];
  belt: number;
  rails?: boolean;
  clad?: boolean;
}
const SPECS: Record<'hatch' | 'sedan' | 'suv' | 'city' | 'van', CarSpec> = {
  hatch: {
    len: 4.1, w: 1.76, bot: 0.3, belt: 1.0,
    body: [[-2.05, 0.6], [-2.03, 0.86], [-1.92, 0.97], [-1.2, 1.0], [0, 1.0], [0.9, 0.99], [1.4, 0.92], [1.85, 0.8], [2.02, 0.66], [2.05, 0.5]],
    cabin: [[-1.86, 0.99], [-1.74, 1.22], [-1.52, 1.4], [-1.1, 1.47], [0, 1.47], [0.3, 1.42], [0.72, 1.2], [1.02, 1.0]],
    roof: [-1.56, 0.32],
  },
  sedan: {
    len: 4.5, w: 1.78, bot: 0.28, belt: 1.02,
    body: [[-2.25, 0.62], [-2.22, 0.92], [-2.02, 1.03], [-1.4, 1.05], [-1.05, 1.03], [0.9, 1.0], [1.5, 0.92], [2.05, 0.78], [2.22, 0.64], [2.25, 0.5]],
    cabin: [[-1.48, 1.03], [-1.16, 1.25], [-0.82, 1.41], [-0.3, 1.46], [0.25, 1.44], [0.7, 1.2], [1.06, 1.0]],
    roof: [-0.86, 0.28],
  },
  suv: {
    len: 4.4, w: 1.86, bot: 0.4, belt: 1.13, rails: true, clad: true,
    body: [[-2.2, 0.72], [-2.18, 1.04], [-2.05, 1.12], [0, 1.14], [0.95, 1.12], [1.5, 1.06], [2.05, 0.96], [2.2, 0.8], [2.2, 0.62]],
    cabin: [[-2.02, 1.12], [-1.92, 1.4], [-1.72, 1.62], [-1.3, 1.69], [0.15, 1.69], [0.45, 1.62], [0.85, 1.35], [1.16, 1.12]],
    roof: [-1.74, 0.46],
  },
  city: {
    len: 3.6, w: 1.64, bot: 0.28, belt: 1.02,
    body: [[-1.8, 0.62], [-1.78, 0.9], [-1.65, 1.02], [0, 1.02], [0.75, 1.01], [1.2, 0.93], [1.68, 0.8], [1.8, 0.54]],
    cabin: [[-1.72, 1.0], [-1.62, 1.35], [-1.4, 1.52], [0, 1.54], [0.25, 1.5], [0.7, 1.2], [0.96, 1.0]],
    roof: [-1.44, 0.27],
  },
  van: {
    len: 4.9, w: 1.94, bot: 0.34, belt: 1.32,
    body: [[-2.45, 0.68], [-2.44, 2.05], [-2.34, 2.27], [0.55, 2.3], [0.92, 2.15], [1.45, 1.42], [1.95, 1.14], [2.4, 0.92], [2.45, 0.6]],
  },
};

/** Sección cerrada de un coche a una altura dada (x, y), de abajo a arriba por los dos lados. */
function section(hw: number, bot: number, top: number) {
  const H = top - bot;
  const half: [number, number][] = [[hw * 0.86, bot], [hw * 0.98, bot + 0.1], [hw, bot + H * 0.42], [hw * 0.985, bot + H * 0.76], [hw * 0.92, top - H * 0.05], [hw * 0.62, top], [hw * 0.28, top + 0.012]];
  return [[0, bot] as [number, number], ...half, [0, top + 0.016] as [number, number], ...[...half].reverse().map(([x, y]) => [-x, y] as [number, number])];
}

function lerpTable(t: Stn[], z: number) {
  if (z <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++)
    if (z <= t[i][0]) {
      const k = (z - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
      return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * k;
    }
  return t[t.length - 1][1];
}

/** Superficie cerrada a partir de anillos de puntos, con normales suaves. */
function loft(rings: { z: number; pts: [number, number][] }[]) {
  const n = rings[0].pts.length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of rings) for (const [x, y] of r.pts) pos.push(x, y, r.z);
  for (let i = 0; i < rings.length - 1; i++)
    for (let k = 0; k < n - 1; k++) {
      const a = i * n + k, b = a + n;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const TYRE = new THREE.CylinderGeometry(0.315, 0.315, 0.21, 22).rotateZ(Math.PI / 2);
const DISC = new THREE.CylinderGeometry(1, 1, 1, 22).rotateZ(Math.PI / 2);

/** Una rueda: cubierta, llanta oscura con cinco radios y el tapacubos. sg: hacia qué lado da su cara. */
function wheel(m: Merger, sg: number, x: number, y: number, z: number) {
  m.add(TYRE, 0x101012, x, y, z);
  const face = x + sg * 0.108;
  m.add(DISC, 0x2a2c30, face, y, z, 0, 0, 0, 0.012, 0.2, 0.2);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * 6.283;
    bar(m, 0xa4a8ae, [face + sg * 0.006, y, z], [face + sg * 0.006, y + Math.cos(a) * 0.19, z + Math.sin(a) * 0.19], 0.012, 0.042);
  }
  m.add(DISC, 0xb0b4ba, face + sg * 0.01, y, z, 0, 0, 0, 0.012, 0.045, 0.045);
}

/** Barra recta entre dos puntos. */
function bar(m: Merger, c: number, a: [number, number, number], b: [number, number, number], t: number, d = t) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const L = Math.hypot(dx, dy, dz) || 1;
  m.add(G.box, c, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, Math.atan2(dz, dy), 0, -Math.asin(dx / L), t, L, d);
}

/** Las tres capas de un modelo: la pintura (se tiñe por coche), los cristales y todo lo demás. */
function carModel(s: CarSpec, withWheels = true) {
  const paint = new Merger(false), glass = new Merger(false), trim = new Merger(false);
  // Los cristales de los faros y los pilotos, aparte: en un coche en marcha van encendidos (sin halo ni haz: solo se
  // ven encendidos, como los del cap. 2)
  const head = new Merger(false), tail = new Merger(false);
  const W = s.w, HW = W / 2, L = s.len;
  // La planta se estrecha un poco en el morro y en la cola
  const plan = (z: number) => HW * (1 - 0.13 * Math.pow(Math.abs(z) / (L / 2), 3.4));
  // Carrocería: anillos a lo largo, cerrada por los dos extremos
  const zs: number[] = [];
  for (let i = 0; i < s.body.length - 1; i++) {
    const [a, b] = [s.body[i][0], s.body[i + 1][0]];
    const steps = Math.max(1, Math.round((b - a) / 0.42));
    for (let k = 0; k < steps; k++) zs.push(a + ((b - a) * k) / steps);
  }
  zs.push(s.body[s.body.length - 1][0]);
  const mkRing = (z: number, shrink = 1): { z: number; pts: [number, number][] } => {
    const top = lerpTable(s.body, z);
    const mid = (s.bot + top) / 2;
    return { z, pts: section(plan(z) * shrink, mid + (s.bot - mid) * shrink, mid + (top - mid) * shrink) };
  };
  const rings = [mkRing(zs[0] - 0.01, 0.01), mkRing(zs[0], 0.86), ...zs.map((z) => mkRing(z)), mkRing(zs[zs.length - 1] + 0.012, 0.86), mkRing(zs[zs.length - 1] + 0.02, 0.01)];
  paint.add(loft(rings), 0xffffff);

  // El habitáculo: cristal y, encima, el techo con sus pilares
  const belt = s.belt;
  if (s.cabin) {
    const t = s.cabin;
    const cz: number[] = [];
    for (let i = 0; i < t.length - 1; i++) {
      const [a, b] = [t[i][0], t[i + 1][0]];
      for (let k = 0; k < 2; k++) cz.push(a + ((b - a) * k) / 2);
    }
    cz.push(t[t.length - 1][0]);
    const hwAt = (z: number, y: number) => {
      const k = THREE.MathUtils.clamp((y - belt) / 0.5, 0, 1);
      return plan(z) * (0.97 - 0.2 * k);
    };
    const glassRing = (z: number, shrink = 1) => {
      const top = Math.max(lerpTable(t, z), belt - 0.04);
      const hw = hwAt(z, top) * shrink;
      const hb = plan(z) * 0.96 * shrink;
      const pts: [number, number][] = [[0, belt - 0.05], [hb, belt - 0.05], [THREE.MathUtils.lerp(hb, hw, 0.6), THREE.MathUtils.lerp(belt, top, 0.6)], [hw, top - 0.025], [hw * 0.6, top], [0, top + 0.012], [-hw * 0.6, top], [-hw, top - 0.025], [-THREE.MathUtils.lerp(hb, hw, 0.6), THREE.MathUtils.lerp(belt, top, 0.6)], [-hb, belt - 0.05], [0, belt - 0.05]];
      return { z, pts };
    };
    glass.add(loft([glassRing(cz[0], 0.01), ...cz.map((z) => glassRing(z)), glassRing(cz[cz.length - 1], 0.01)]), 0xffffff);
    // Techo pintado, un poco por encima
    const [r0, r1] = s.roof!;
    const roofRing = (z: number, sk = 1) => {
      const top = lerpTable(t, z) + 0.012;
      const hw = hwAt(z, top) * 0.97 * sk;
      const pts: [number, number][] = [[0, top - 0.06], [hw * 1.02, top - 0.06], [hw, top - 0.022], [hw * 0.62, top], [0, top + 0.016], [-hw * 0.62, top], [-hw, top - 0.022], [-hw * 1.02, top - 0.06], [0, top - 0.06]];
      return { z, pts };
    };
    const rz: number[] = [];
    for (let i = 0; i <= 8; i++) rz.push(r0 + ((r1 - r0) * i) / 8);
    paint.add(loft([roofRing(r0, 0.01), ...rz.map((z) => roofRing(z)), roofRing(r1, 0.01)]), 0xffffff);
    // Pilares: el del parabrisas, el central (negro) y los de atrás
    const pillar = (z0: number, z1: number, c: number, wid: number, role: Merger) => {
      for (const sg of [-1, 1]) {
        const y1 = lerpTable(t, z1) - 0.05;
        bar(role, c, [sg * plan(z0) * 0.965, belt - 0.02, z0], [sg * hwAt(z1, y1) * 1.002, y1, z1], 0.05, wid);
      }
    };
    const front = t[t.length - 1][0];
    pillar(front - 0.04, r1 + 0.02, 0xffffff, 0.09, paint);
    const midZ = (r0 + r1) / 2;
    pillar(midZ - 0.05, midZ - 0.05, 0x101114, 0.1, trim);
    pillar(r0 - 0.2, r0 + 0.02, 0xffffff, 0.15, paint);
    // Marco negro de las ventanillas y moldura de la cintura
    for (const sg of [-1, 1]) {
      bar(trim, 0x0d0e10, [sg * plan(0) * 0.975, belt - 0.015, front - 0.1], [sg * plan(0) * 0.975, belt - 0.015, r0 - 0.06], 0.022, 0.03);
      bar(trim, 0x0d0e10, [sg * hwAt(midZ, 1.4) * 1.0, lerpTable(t, midZ) - 0.05, r0], [sg * hwAt(midZ, 1.4) * 1.0, lerpTable(t, midZ) - 0.05, r1], 0.02, 0.025);
    }
    // Limpiaparabrisas
    for (const sx of [-0.1, 0.38]) bar(trim, 0x050506, [sx - 0.3, belt + 0.03, front - 0.1], [sx + 0.1, belt + 0.09, front - 0.3], 0.018, 0.01);
    if (s.rails) for (const sg of [-1, 1]) m3rail(trim, sg * HW * 0.72, lerpTable(t, 0) + 0.035, r0 + 0.1, r1 - 0.08);
  } else {
    // Furgoneta: parabrisas grande, ventanilla de la puerta delantera y puerta corredera
    const pts = s.body;
    const a = pts[4], b = pts[5];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    glass.add(G.box, 0xffffff, 0, my, mx + 0.006, -Math.atan2(b[0] - a[0], a[1] - b[1]), 0, 0, W * 0.8, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.86, 0.04);
    for (const sg of [-1, 1]) {
      glass.add(G.box, 0xffffff, sg * (plan(0.8) * 0.96), 1.68, 0.86, 0, 0, 0, 0.03, 0.56, 0.72);
      trim.add(G.box, 0x121316, sg * (plan(-0.8) * 0.995), 1.2, -0.35, 0, 0, 0, 0.012, 1.55, 0.02);
      trim.add(G.box, 0x121316, sg * (plan(0.3) * 0.995), 1.2, 0.42, 0, 0, 0, 0.012, 1.55, 0.02);
    }
    glass.add(G.box, 0xffffff, 0, 1.68, -2.45, 0, 0, 0, W * 0.74, 0.5, 0.03);
    trim.add(G.box, 0x121316, 0, 1.3, -2.46, 0, 0, 0, 0.02, 1.7, 0.02);
    trim.add(G.box, 0x24262a, 0, 2.34, -0.9, 0, 0, 0, 1.2, 0.04, 0.05);
    trim.add(G.box, 0x24262a, 0, 2.34, -1.9, 0, 0, 0, 1.2, 0.04, 0.05);
  }

  // Ruedas, con su paso de rueda oscuro
  const wz = L / 2 - 0.78;
  for (const sz of [1, -1])
    for (const sg of [-1, 1]) {
      const z = sz * wz + (sz > 0 ? 0.02 : 0);
      trim.add(DISC, 0x050506, sg * (plan(z) * 0.985), 0.34, z, 0, 0, 0, 0.05, 0.385, 0.385);
      if (s.clad) trim.add(new THREE.TorusGeometry(0.41, 0.045, 6, 18, Math.PI).rotateY(Math.PI / 2), 0x18191c, sg * plan(z), 0.34, z);
      if (withWheels) wheel(trim, sg, sg * (plan(z) - 0.08), 0.315, z);
    }

  // Faldón, juntas de las puertas, manetas y retrovisores
  for (const sg of [-1, 1]) {
    bar(trim, 0x0e0f11, [sg * plan(0) * 0.93, s.bot + 0.03, wz - 0.42], [sg * plan(0) * 0.93, s.bot + 0.03, -wz + 0.42], 0.06, 0.1);
    if (s.cabin) {
      const front = s.cabin[s.cabin.length - 1][0];
      const doors = s.len > 3.8 ? [front - 0.02, (s.roof![0] + s.roof![1]) / 2 - 0.05, s.roof![0] + 0.08] : [front - 0.02, s.roof![0] + 0.25];
      for (const d of doors) bar(trim, 0x090a0b, [sg * plan(d) * 1.002, s.bot + 0.13, d], [sg * plan(d) * 0.995, s.belt - 0.03, d], 0.007, 0.012);
      for (let i = 0; i < doors.length - 1; i++) trim.add(G.rbox, 0x8d9096, sg * plan(doors[i]) * 1.005, s.belt - 0.12, doors[i] - 0.3, 0, 0, 0, 0.022, 0.03, 0.14);
      const mz = front + 0.06;
      trim.add(G.rbox, 0x16171a, sg * (plan(mz) + 0.1), s.belt + 0.06, mz, 0, sg * 0.2, 0, 0.19, 0.12, 0.09);
      paint.add(G.rbox, 0xffffff, sg * (plan(mz) + 0.1), s.belt + 0.08, mz + 0.012, 0, sg * 0.2, 0, 0.17, 0.09, 0.085);
    } else {
      trim.add(G.rbox, 0x16171a, sg * (plan(1.1) + 0.12), 1.46, 1.1, 0, 0, 0, 0.14, 0.24, 0.07);
    }
  }

  // Cara y cola
  const FZ = s.body[s.body.length - 1][0], RZ = s.body[0][0];
  const fy = lerpTable(s.body, FZ - 0.22), ry = lerpTable(s.body, RZ + 0.1);
  const hy = s === SPECS.van ? 0.98 : fy - 0.1;
  for (const sg of [-1, 1]) {
    // Faros: óptica con el fondo oscuro y el cristal claro
    trim.add(G.rbox, 0x1a1c20, sg * (HW * 0.62), hy, FZ - 0.1, 0, sg * 0.32, 0, 0.5, 0.17, 0.2);
    trim.add(G.rbox, 0xdfe6ea, sg * (HW * 0.64), hy, FZ - 0.04, 0, sg * 0.32, 0, 0.42, 0.13, 0.17);
    trim.add(G.rbox, 0xf6f4e4, sg * (HW * 0.58), hy, FZ - 0.015, 0, sg * 0.32, 0, 0.12, 0.08, 0.14);
    head.add(G.rbox, 0xfff4dc, sg * (HW * 0.64), hy, FZ - 0.035, 0, sg * 0.32, 0, 0.44, 0.15, 0.21);
    // Pilotos
    const ty = s === SPECS.van ? 1.15 : ry - 0.02;
    trim.add(G.rbox, 0x7a0e12, sg * (HW * 0.72), ty, RZ + 0.05, 0, -sg * 0.26, 0, 0.42, s === SPECS.van ? 0.3 : 0.17, 0.12);
    trim.add(G.rbox, 0xc62a22, sg * (HW * 0.72), ty, RZ + 0.02, 0, -sg * 0.26, 0, 0.32, s === SPECS.van ? 0.2 : 0.09, 0.09);
    tail.add(G.rbox, 0xff3a26, sg * (HW * 0.72), ty, RZ + 0.015, 0, -sg * 0.26, 0, 0.35, s === SPECS.van ? 0.22 : 0.11, 0.11);
    trim.add(G.rbox, 0xe3a23a, sg * (HW * 0.8), s.bot + 0.28, FZ - 0.05, 0, 0, 0, 0.1, 0.05, 0.08);
    // Luz de niebla y reflectante
    trim.add(DISC.clone().rotateY(Math.PI / 2), 0xcfd3d6, sg * (HW * 0.68), s.bot + 0.14, FZ + 0.012, 0, 0, 0, 0.09, 0.09, 0.012);
    trim.add(G.box, 0x6a0c10, sg * (HW * 0.62), s.bot + 0.12, RZ - 0.01, 0, 0, 0, 0.26, 0.035, 0.012);
  }
  // Parachoques con la toma de aire y la calandra
  trim.add(G.rbox, 0x121316, 0, s.bot + 0.11, FZ - 0.02, 0, 0, 0, W * 0.78, 0.16, 0.1);
  trim.add(G.rbox, 0x121316, 0, s.bot + 0.12, RZ + 0.02, 0, 0, 0, W * 0.78, 0.14, 0.1);
  trim.add(G.rbox, 0x0a0b0c, 0, hy, FZ - 0.02, 0, 0, 0, W * 0.38, 0.1, 0.05);
  for (let i = 0; i < 2; i++) trim.add(G.box, 0x6a6e74, 0, hy - 0.024 + i * 0.05, FZ + 0.012, 0, 0, 0, W * 0.34, 0.008, 0.008);
  trim.add(G.rbox, 0xb6b9be, 0, hy, FZ + 0.012, 0, 0, 0, 0.1, 0.06, 0.012);
  // Matrículas blancas, con la franja azul y los números
  const plate = (z: number, y: number, sign: number) => {
    trim.add(G.box, 0xe8e8e2, 0, y, z, 0, 0, 0, 0.52, 0.11, 0.008);
    trim.add(G.box, 0x1a3a9a, -0.235, y, z + sign * 0.005, 0, 0, 0, 0.045, 0.1, 0.004);
    for (let i = 0; i < 7; i++) trim.add(G.box, 0x151515, -0.165 + i * 0.062, y, z + sign * 0.006, 0, 0, 0, 0.038, 0.066, 0.004);
  };
  plate(FZ + 0.03, s.bot + 0.22, 1);
  plate(RZ - 0.02, s.bot + 0.3, -1);
  if (s === SPECS.hatch || s === SPECS.suv || s === SPECS.city) trim.add(G.box, 0x0a0b0c, 0, lerpTable(s.cabin!, RZ + 0.25) - 0.05, RZ + 0.26, 0.5, 0, 0, 0.28, 0.012, 0.02);
  trim.add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8).rotateX(Math.PI / 2), 0x8d9096, HW * 0.45, s.bot + 0.03, RZ + 0.02);
  return { paint: paint.build(), glass: glass.build(), trim: trim.build(), head: head.build(), tail: tail.build() };
}

function m3rail(m: Merger, x: number, y: number, z0: number, z1: number) {
  m.add(G.box, 0x22242a, x, y + 0.03, (z0 + z1) / 2, 0, 0, 0, 0.035, 0.03, z1 - z0);
  for (const z of [z0, z1]) m.add(G.box, 0x22242a, x, y + 0.008, z, 0, 0, 0, 0.04, 0.04, 0.06);
}

let mats: { paint: THREE.MeshPhysicalMaterial; glass: THREE.MeshPhysicalMaterial; trim: THREE.MeshStandardMaterial; lamp: THREE.MeshBasicMaterial } | null = null;
function carMaterials() {
  return (mats ??= {
    paint: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0a0e13, roughness: 0.06, metalness: 0.75, clearcoat: 1 }),
    trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.28 }),
    // (faros y pilotos encendidos: color pleno, sin sombra)
    lamp: new THREE.MeshBasicMaterial({ vertexColors: true }),
  });
}

/** Faros y pilotos encendidos de un modelo, para un coche en marcha (los aparcados, apagados). */
function carLamps(model: ReturnType<typeof carModel>) {
  const { lamp } = carMaterials();
  const h = new THREE.Mesh(model.head, lamp), t = new THREE.Mesh(model.tail, lamp);
  h.userData.noCast = t.userData.noCast = true;
  return [h, t];
}

/** Taxi de Menorca: una berlina blanca, con su cajetín en el techo, su rótulo en la puerta y la luz verde de libre. */
export function makeTaxi(opts: { back?: PersonLook } = {}) {
  const M = carMaterials();
  const spec = SPECS.sedan;
  const model = carModel(spec, false);
  const root = new THREE.Group();
  root.userData.noCam = true;
  // (se mueve: el cómic no lo dobla a mano alzada; si no, viajaba torcido)
  root.userData.comicBent = true;
  const body = new THREE.Group();
  root.add(body);
  const paint = M.paint.clone();
  paint.color.set(0xf4f4ef);
  const parts = [new THREE.Mesh(model.paint, paint), new THREE.Mesh(model.glass, M.glass), new THREE.Mesh(model.trim, M.trim)];
  for (const b of parts) {
    b.castShadow = true;
    b.receiveShadow = true;
    body.add(b);
  }
  body.add(...carLamps(model));
  // Ruedas: van aparte para que rueden
  const wheelM = new Merger(false);
  wheel(wheelM, 1, 0, 0.315, 0);
  const wheelL = wheelM.build();
  const wheelM2 = new Merger(false);
  wheel(wheelM2, -1, 0, 0.315, 0);
  const wheelR = wheelM2.build();
  const wheels: THREE.Object3D[] = [];
  const wz = spec.len / 2 - 0.78;
  for (const sz of [1, -1])
    for (const sg of [1, -1]) {
      const z = sz * wz + (sz > 0 ? 0.02 : 0);
      const w = new THREE.Mesh(sg > 0 ? wheelL : wheelR, M.trim);
      const holder = new THREE.Group();
      holder.position.set(sg * (spec.w / 2 * (1 - 0.13 * Math.pow(Math.abs(z) / (spec.len / 2), 3.4)) - 0.08), 0.315, z);
      w.position.y = -0.315;
      w.castShadow = true;
      holder.add(w);
      root.add(holder);
      wheels.push(holder);
    }
  // Ocupantes: el taxista delante a la izquierda; ella, a su lado; detrás, quien vaya (Gas, cojo, se estira)
  const azul = new THREE.Group();
  const joy = new THREE.Group();
  const drv = seated(TAXI_DRIVER, 0.95, 0.9);
  if (drv.rig) drv.root.position.set(SEAT.driver[0], 0.6 - drv.rig.hipsHeight * 0.95, SEAT.driver[2]);
  body.add(drv.root);
  const her = seated(MARGAUX_LOOK, 0.95, 0.35);
  if (her.rig) her.root.position.set(SEAT.front[0], 0.6 - her.rig.hipsHeight * 0.95, SEAT.front[2]);
  azul.add(her.root);
  body.add(azul);
  const back = new THREE.Group();
  if (opts.back) {
    const him = seated(opts.back, 0.95, 0.35);
    if (him.rig) him.root.position.set(SEAT.back[0], 0.62 - him.rig.hipsHeight * 0.95, SEAT.back[2]);
    back.add(him.root);
  }
  body.add(back);
  const tex = canvasTex((x, w, h) => {
    x.fillStyle = '#fbfbf2';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#16365a';
    x.font = 'bold 74px Arial, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('TAXI', w / 2, h / 2 + 3);
  }, 256, 96);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.2), new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false }));
  sign.position.set(0, 1.56, -0.32);
  body.add(sign);
  // La luz verde: encendida si va libre; con gente dentro, apagada (ver taxiFree)
  const green = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: GREEN_ON, fog: false, toneMapped: false }));
  green.position.set(0.38, 1.52, -0.32);
  body.add(green);
  // En las puertas, el rótulo (con luz: de noche, una pegatina no brilla sola)
  const door = canvasTex((x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#16365a';
    x.font = 'bold 44px Arial, sans-serif';
    x.textAlign = 'center';
    x.fillText('TAXI', w / 2, 46);
    x.font = '26px Arial, sans-serif';
    x.fillText('Ciutadella de Menorca', w / 2, 84);
  }, 320, 100);
  const doorMat = new THREE.MeshStandardMaterial({ map: door, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const sg of [-1, 1]) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.27), doorMat);
    d.position.set(sg * 0.896, 0.68, 0.08);
    d.rotation.y = (sg * Math.PI) / 2;
    d.userData.noCast = true;
    body.add(d);
  }
  return { root, body, joy, wheels, azul, back, green };
}

export type Taxi = ReturnType<typeof makeTaxi>;

const GREEN_ON = 0x38ff6a;
/** Asientos del taxi (locales, mirando a +z; +x es la izquierda): el taxista, ella delante y quien va detrás. */
const SEAT = { driver: [0.4, 0, -0.2], front: [-0.4, 0, -0.2], back: [0.32, 0, -1.08] } as const;

/** Libre (luz verde encendida) u ocupado (apagada), como los de verdad. */
export function taxiFree(t: Taxi, free: boolean) {
  (t.green.material as THREE.MeshBasicMaterial).color.setHex(free ? GREEN_ON : 0x1f3326);
}

/**
 * De dónde sale el bocadillo de quien va en el taxi (cada uno desde su asiento, como en el coche del cap. 2): el
 * taxista y Gas a la izquierda, ella a la derecha. null si no es de los que van dentro.
 */
export function taxiSeat(t: Taxi, who: string) {
  const s = who === 'Taxista' ? SEAT.driver : who === 'Margaux' || who === 'Azul' ? SEAT.front : who === 'Gas' || who === 'Marc' ? SEAT.back : null;
  if (!s) return null;
  return t.body.localToWorld(new THREE.Vector3(s[0], who === 'Gas' || who === 'Marc' ? 1.58 : 1.64, s[2]));
}

/** Hacia qué lado se abre su globo (el taxista y Gas van a la izquierda; ella, a la derecha). */
export function taxiSide(who: string): 'l' | 'r' {
  return who === 'Margaux' || who === 'Azul' ? 'r' : 'l';
}

// ---------------- El camino ----------------

/** Hasta dónde puede seguir el taxi si aún les queda conversación (la carretera sigue hasta LEN + 60). */
const RIDE_END = TO_Z + 45;

export class TaxiRide {
  scene = new THREE.Scene();
  private sky: Sky;
  private sun: Sun;
  /** El taxi, con Gas detrás (cojo, estirado en el asiento de atrás). Va ocupado: luz verde apagada. */
  readonly taxi = makeTaxi({ back: MARC_LOOK });
  private rig!: CarRig;
  private t = 0;
  /** Por dónde va (z), a qué velocidad y su velocidad de crucero (la que hace que les dé tiempo a hablar). */
  private z = FROM_Z;
  private v = 5;
  private vmax = 10;
  private lampZ: number[] = [];
  private moths: THREE.Points;
  private lampA = new THREE.Vector3();
  private lampB = new THREE.Vector3();
  private oncoming: { root: THREE.Group; v: number }[] = [];
  private walkers: { p: Person; v: number }[] = [];
  private camLook = new THREE.Vector3();
  private v1 = new THREE.Vector3();
  done = false;

  constructor() {
    const sc = this.scene;
    // De madrugada, como la noche del cap. 2: perfil «noche», poco ambiente y la luz de luna azul que dibuja
    sc.userData.comicLook = 'noche';
    sc.userData.hemiScale = 0.32;
    // (un viaje tranquilo a casa de madrugada: sin líneas de velocidad todo el camino; solo en la rama principal)
    sc.userData.speedLines = 0;
    sc.fog = new THREE.Fog(0x0b1030, 35, 150);
    this.sky = new Sky({ top: 0x02030f, mid: 0x0b1440, bottom: 0x1d2350, stars: 1400 });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0x6f7fc0, 0x1a2030, 1.1));
    this.sun = new Sun(sc, 0xb8c8ff, 2.0, new THREE.Vector3(-0.3, 1, 0.55), 26);
    // (luz baja: sin esto, rayas de sombra en las superficies largas, como en el pasillo del cap. 2)
    this.sun.light.shadow.normalBias = 0.16;
    this.sun.light.shadow.bias = -0.0012;
    // (y ninguna luz de lámpara: ni las farolas ni los faros iluminan nada; solo se ven encendidos)

    const midZ = LEN / 2;
    this.buildGround(midZ);
    this.buildWall(midZ);
    const m = new Merger();
    const glow = new Merger(false);
    this.buildVerge(m);
    this.buildGates(m, glow);
    this.buildVillas(m, glow);
    this.buildStreetKit(m);
    sc.add(m.mesh());
    const gm = new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    gm.userData.noCast = true;
    sc.add(gm);
    this.buildCars();
    this.buildLamps();
    this.buildPines();
    this.buildPlate();
    this.buildTaxi();
    this.moths = this.makeMoths();
    this.buildWalkers();
    this.buildOncoming();
    applyShadows(sc);
    sc.traverse((o) => {
      if (o.userData.noCast) o.castShadow = false;
    });
    settleAmbient(sc);
  }

  /** Asfalto, arcén de tierra roja y suelo del pinar, con su dibujo de tebeo; la línea discontinua, pintada plana. */
  private buildGround(midZ: number) {
    const sc = this.scene;
    const L = LEN + 120;
    const add = (w: number, y: number, mat: THREE.Material) => {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w, L).rotateX(-Math.PI / 2), mat);
      g.position.set(0, y, midZ);
      g.receiveShadow = true;
      g.userData.noCast = true;
      sc.add(g);
    };
    // (antes, un lienzo de 2048 × 6144 con foto pintada: el cómic lo reducía y la línea y las grietas desaparecían)
    add(7, 0.012, toon({ color: 0x4a4a50, roughness: 0.92, surf: Surf.Asphalt }));
    add(ROAD_W, 0.006, toon({ color: EARTH, roughness: 1, surf: Surf.Sand }));
    add(420, -0.03, toon({ color: FOREST, roughness: 1, surf: Surf.Sand }));
    // La línea discontinua del centro, plana sobre el asfalto (sin grosor: la tinta no le dibuja dientes de sierra)
    const paint = new Merger(false);
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let z = midZ - L / 2 + 1; z < midZ + L / 2; z += 5.5) paint.add(flat, 0xe6e2d6, 0, 0.02, z, 0, 0, 0, 0.11, 1, 2.6);
    const lines = new THREE.Mesh(paint.build(), paintMat());
    lines.userData.noCast = true;
    sc.add(lines);
    for (const z of [LEN + 62, -66]) {
      const fade = canvasTex((x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, 'rgba(11,16,48,0)');
        g.addColorStop(0.45, 'rgba(11,16,48,1)');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
      }, 4, 64);
      const end = new THREE.Mesh(new THREE.PlaneGeometry(320, 26), new THREE.MeshBasicMaterial({ map: fade, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      end.position.set(0, 13, z);
      end.userData.noCast = true;
      sc.add(end);
    }
  }

  /** El muro: una tira de piedra seca dibujada, con su remate irregular y piedras sueltas arriba y al pie. */
  private buildWall(midZ: number) {
    const sc = this.scene;
    const L = LEN + 120;
    const seg = Math.round(L / 1.3);
    const front = new THREE.PlaneGeometry(L, 1.38, seg, 4);
    const p = front.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i), ly = p.getY(i);
      const k = (ly + 0.69) / 1.38;
      // Las piedras sobresalen; arriba, el muro no es recto
      const n = Math.sin(lx * 3.1) * 0.05 + Math.sin(lx * 7.7 + ly * 4) * 0.04 + Math.sin(ly * 9 + lx) * 0.02;
      p.setZ(i, n);
      p.setY(i, ly + k * (Math.sin(lx * 1.3) * 0.08 + Math.sin(lx * 3.7) * 0.05 + Math.sin(lx * 0.31) * 0.1));
    }
    front.computeVertexNormals();
    front.rotateY(-Math.PI / 2);
    // (el dibujo de piedra seca de tebeo, triplanar: el lienzo de foto con relieve se perdía en el cómic)
    const wall = new THREE.Mesh(front, toon({ color: 0x9c9078, roughness: 1, surf: Surf.DryStone }));
    wall.position.set(WALL_X + 0.42, 0.68, midZ);
    wall.rotation.y = Math.PI;
    wall.receiveShadow = true;
    sc.add(wall);
    const m = new Merger();
    for (let z = -50, i = 0; z < LEN + 60; z += 0.74, i++) {
      m.add(i % 2 ? G.rock : G.crag, i % 3 ? 0x8e8472 : 0x9c9078, WALL_X + 0.1 + Math.sin(i * 2.1) * 0.14, 1.38 + Math.sin(z * 1.3) * 0.08 + Math.sin(z * 3.7) * 0.05 + (i % 4) * 0.02, z, i * 0.4, i, 0, 0.58, 0.26 + (i % 3) * 0.06, 0.64);
      if (i % 3 === 0) m.add(G.crag, 0x9a8a70, WALL_X + 0.58 + Math.sin(i) * 0.08, 0.06, z, 0, i, 0, 0.3 + (i % 4) * 0.08, 0.16, 0.3);
    }
    // Lo que se ve por detrás del muro
    for (let z = -50, i = 0; z < LEN + 60; z += 2.6, i++) m.add(G.bush, i % 4 ? 0x3e6e34 : 0x4a7c3c, WALL_X - 1.05, 1.5 + (i % 3) * 0.3, z + 0.3, 0, i, 0, 2.2, 1.9, 2.5);
    sc.add(m.mesh());
  }

  /** La otra orilla: matorral, hierba seca y tierra amontonada, con piñas y piedras por el suelo. */
  private buildVerge(m: Merger) {
    for (let i = 0; i < 74; i++) {
      const z = -40 + i * 4.8 + Math.sin(i * 1.7) * 1.6;
      m.add(G.bush, i % 3 ? 0x3e6e34 : 0x57803e, 8.5 + Math.sin(i * 2.7) * 1.2, 0.8 + (i % 3) * 0.25, z, 0, i, 0, 2.6, 1.9, 2.8);
      if (i % 2) m.add(G.tuft, 0x8d8f4a, 7.1, 0, z + 1.2, 0, i, 0, 1.2, 1, 1.2);
      m.add(G.tuft, 0x7f7d3e, 7.3 + (i % 3) * 0.2, 0, z - 1.7, 0, i * 2, 0, 1.3, 1.25, 1.3);
      m.add(G.tuft, 0x9b9450, -6.6, 0, z + 0.7, 0, i * 3, 0, 0.8, 0.8, 0.8);
    }
    // Piñas caídas y piedras
    for (let i = 0; i < 120; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (5.6 + ((i * 17) % 13) * 0.11), z = -30 + ((i * 53) % (LEN + 40));
      if (i % 3) m.add(G.ball, 0x5c3f28, x, 0.05, z, i, i * 2, 0, 0.1, 0.13, 0.1);
      else m.add(G.crag, 0xa69a84, x, 0.05, z, 0, i, 0, 0.26, 0.14, 0.2);
    }
    // Montón de leña y restos de poda
    for (const z of [62, 171]) {
      for (let i = 0; i < 12; i++) m.add(G.cyl, 0x6a4a30, 7.2 + (i % 3) * 0.05, 0.14 + Math.floor(i / 4) * 0.2, z + (i % 4) * 0.26 - 0.4, Math.PI / 2, 0, 0.2, 0.2, 1.8, 0.2);
    }
  }

  /** Cancelas en el muro: pilares encalados con bola, verja, número, buzón y un farol. */
  private buildGates(m: Merger, glow: Merger) {
    const ZS = [41, 92, 138, 186, 226];
    ZS.forEach((z, i) => {
      const x = WALL_X + 0.1;
      // Hueco oscuro de la entrada y el camino de tierra que sale de ella
      m.add(G.box, 0x6d4530, x - 2.2, 0.012, z, 0, 0, 0, 5, 0.02, 3.2);
      for (const s of [-1, 1]) {
        m.add(G.box, 0xe9e4d8, x, 0.95, z + s * 1.75, 0, 0, 0, 0.62, 1.9, 0.62);
        m.add(G.box, 0xd9d3c4, x, 1.94, z + s * 1.75, 0, 0, 0, 0.72, 0.09, 0.72);
        m.add(G.ball, 0xe9e4d8, x, 2.14, z + s * 1.75, 0, 0, 0, 0.32, 0.32, 0.32);
      }
      const wood = i % 2 === 0;
      if (wood) {
        // Barrera menorquina, de acebuche: palos curvos y gastados
        for (const y of [0.45, 0.72, 0.99, 1.26]) m.add(G.box, 0x8d7b62, x, y, z, 0, 0, 0, 0.05, 0.075, 2.9);
        for (const dz of [-1.35, -0.45, 0.45, 1.35]) m.add(G.box, 0x7d6b52, x, 0.82, z + dz, 0, 0, dz * 0.03, 0.05, 1.2, 0.07);
        bar(m, 0x7d6b52, [x, 0.3, z - 1.35], [x, 1.32, z + 1.35], 0.05, 0.07);
      } else {
        // Verja de hierro pintada de verde
        // (barrotes de 3,5 cm: con 2,2 la tinta temblaba)
        for (let k = -11; k <= 11; k++) m.add(G.box, 0x24382a, x, 0.92, z + k * 0.13, 0, 0, 0, 0.035, 1.45 + (11 - Math.abs(k)) * 0.019, 0.035);
        for (const y of [0.3, 1.5]) m.add(G.box, 0x24382a, x, y, z, 0, 0, 0, 0.04, 0.05, 2.9);
      }
      // Azulejo con el número y buzón
      m.add(G.box, 0xf4f1e8, x + 0.32, 1.42, z + 1.75, 0, 0, 0, 0.012, 0.16, 0.22);
      m.add(G.box, 0x1a4a8a, x + 0.325, 1.42, z + 1.75, 0, 0, 0, 0.008, 0.08, 0.1);
      m.add(G.rbox, 0x4e5a60, x + 0.34, 1.02, z - 1.75, 0, 0, 0, 0.14, 0.3, 0.36);
      m.add(G.box, 0x22262a, x + 0.415, 1.1, z - 1.75, 0, 0, 0, 0.01, 0.025, 0.24);
      // Farol encendido en un pilar
      m.add(G.box, 0x1a1a1c, x, 2.42, z - 1.75, 0, 0, 0, 0.2, 0.05, 0.2);
      glow.add(G.box, 0xffcf8c, x, 2.56, z - 1.75, 0, 0, 0, 0.14, 0.22, 0.14);
      m.add(G.box, 0x1a1a1c, x, 2.7, z - 1.75, 0, 0.78, 0, 0.26, 0.05, 0.26);
    });
    this.gateLights = ZS.map((z) => [WALL_X + 0.1, 2.56, z - 1.75]);
  }
  private gateLights: number[][] = [];

  /** Villas blancas detrás de los árboles, con las ventanas encendidas y algún porche. */
  private buildVillas(m: Merger, glow: Merger) {
    const V: [number, number, number, number][] = [[-20, 34, 12, 8], [24, 56, 10, 9], [-23, 86, 14, 9], [21, 112, 12, 8], [-20, 134, 10, 8], [26, 152, 13, 9], [-24, 182, 12, 10], [22, 206, 11, 9], [-20, 228, 13, 8], [25, 256, 12, 9]];
    V.forEach(([x, z, w, d], i) => {
      const H = 3.2 + (i % 3 === 0 ? 2.9 : 0);
      m.add(G.box, 0xede7da, x, H / 2, z, 0, 0, 0, d, H, w);
      m.add(G.box, 0xb9b3a4, x, 0.2, z, 0, 0, 0, d + 0.1, 0.4, w + 0.1);
      // Tejado árabe a dos aguas
      m.add(G.box, 0xa8593c, x - d * 0.26, H + 0.56, z, 0, 0, 0.3, d * 0.58, 0.14, w + 0.7);
      m.add(G.box, 0xa8593c, x + d * 0.26, H + 0.56, z, 0, 0, -0.3, d * 0.58, 0.14, w + 0.7);
      m.add(G.box, 0xede7da, x, H + 0.4, z, 0, 0, 0, d * 0.72, 0.8, w - 0.1);
      // La cara que da a la carretera
      const face = x < 0 ? x + d / 2 + 0.03 : x - d / 2 - 0.03;
      const sg = x < 0 ? 1 : -1;
      for (let k = 0; k < 4; k++) {
        const wz = z - w / 2 + 1.5 + k * ((w - 3) / 3);
        // (de madrugada casi todo el mundo duerme: una ventana encendida de cada cinco)
        const lit = (i * 3 + k * 5) % 5 === 0;
        const fl = i % 3 === 0 && k % 2 === 0 ? 1 : 0;
        const y = 1.5 + fl * 2.9;
        if (lit) glow.add(G.box, (i + k) % 2 ? 0xffc77f : 0xffe0a8, face + sg * 0.012, y, wz, 0, 0, 0, 0.02, 1.12, 0.86);
        else m.add(G.box, 0x1a2230, face + sg * 0.012, y, wz, 0, 0, 0, 0.02, 1.12, 0.86);
        // Marco y persianas verdes abiertas
        m.add(G.box, 0xd8d2c4, face + sg * 0.03, y + 0.62, wz, 0, 0, 0, 0.03, 0.08, 1);
        m.add(G.box, 0xd8d2c4, face + sg * 0.03, y - 0.62, wz, 0, 0, 0, 0.05, 0.08, 1.04);
        for (const s of [-1, 1]) m.add(G.box, 0x2f6b46, face + sg * 0.04, y, wz + s * 0.72, 0, 0, 0, 0.03, 1.2, 0.52);
      }
      // Porche con su luz
      m.add(G.box, 0xe0dacb, face + sg * 1.3, 2.7, z, 0, 0, 0, 2.6, 0.14, 3.4);
      for (const s of [-1, 1]) m.add(G.cyl, 0xefe9dc, face + sg * 2.4, 1.35, z + s * 1.5, 0, 0, 0, 0.22, 2.7, 0.22);
      glow.add(G.ball, 0xffe0a8, face + sg * 1.4, 2.5, z, 0, 0, 0, 0.2, 0.2, 0.2);
      // Pared del jardín y palmera o ciprés
      m.add(G.cyl, 0x3a3020, x + sg * (d / 2 + 4), 1.2, z + w / 2 + 2, 0, 0, 0, 0.3, 2.4, 0.3);
      m.add(G.ball, 0x2c4c2c, x + sg * (d / 2 + 4), 4, z + w / 2 + 2, 0, 0, 0, 1.2, 5, 1.2);
    });
  }

  /** Lo que tiene toda calle: señales, contenedores, postes y cables, un transformador y los espejos del cruce. */
  private buildStreetKit(m: Merger) {
    // Postes de madera con crucetas, aisladores y tres cables
    let prev: number | null = null;
    for (let z = -10; z < LEN + 40; z += 27) {
      m.add(new THREE.CylinderGeometry(0.09, 0.15, 8.8, 9), 0x4f3d2c, 7.05, 4.4, z, 0, 0, 0.012);
      m.add(G.box, 0x5a4634, 7.05, 8.1, z, 0, 0, 0, 1.2, 0.08, 0.08);
      bar(m, 0x444444, [6.62, 7.5, z], [7.03, 8.06, z], 0.025);
      bar(m, 0x444444, [7.48, 7.5, z], [7.07, 8.06, z], 0.025);
      for (const dx of [-0.5, 0, 0.5]) m.add(G.cyl, 0xcfd6da, 7.05 + dx, 8.2, z, 0, 0, 0, 0.05, 0.12, 0.05);
      if (prev !== null)
        for (const dx of [-0.5, 0, 0.5])
          for (let k = 0; k < 5; k++) {
            const a = k / 5, b = (k + 1) / 5;
            const sag = (u: number) => 8.25 - Math.sin(u * Math.PI) * 0.7;
            const z0 = prev + (z - prev) * a, z1 = prev + (z - prev) * b;
            const y0 = sag(a), y1 = sag(b);
            // (3,5 cm: los de 2 cm salían con la tinta a trozos)
            m.add(G.box, 0x121214, 7.05 + dx, (y0 + y1) / 2, (z0 + z1) / 2, Math.atan2(y0 - y1, z1 - z0), 0, 0, 0.035, 0.035, Math.hypot(z1 - z0, y1 - y0));
          }
      prev = z;
    }
    // Transformador en un poste y su caja
    m.add(G.rbox, 0x6a7276, 7.3, 5.8, 80, 0, 0, 0, 0.6, 1.1, 0.6);
    m.add(G.box, 0xc8c2b4, 8, 0.7, 84, 0, 0, 0, 0.6, 1.4, 1.2);
    m.add(G.box, 0x7a8086, 7.68, 0.7, 84, 0, 0, 0, 0.02, 1.1, 0.9);
    // Contenedores de basura verdes, azul y amarillo
    for (const [z, c] of [[66, 0x35573c], [68.2, 0x35573c], [70.4, 0x27508a], [72.6, 0xc69e2b], [176, 0x35573c], [178.2, 0x35573c]] as const) {
      m.add(G.rbox, c, 6.85, 0.7, z, 0, 0, 0, 1.3, 1.25, 1.95);
      m.add(G.rbox, c, 6.85, 1.38, z, 0.02, 0, 0, 1.38, 0.14, 2.04);
      for (const s of [-1, 1]) m.add(G.cyl, 0x151515, 6.3, 0.09, z + s * 0.75, 0, 0, Math.PI / 2, 0.18, 0.1, 0.18);
      m.add(G.box, 0xdedad0, 6.2, 0.8, z, 0, 0, 0, 0.01, 0.35, 0.8);
    }
    // Señales: velocidad, curva y cruce
    const sign = (x: number, z: number, kind: 'limit' | 'warn' | 'stop') => {
      m.add(G.cyl, 0x8a8e92, x, 1.3, z, 0, 0, 0, 0.06, 2.6, 0.06);
      const fy = Math.PI / 2 * Math.sign(-x);
      if (kind === 'limit') {
        m.add(new THREE.CylinderGeometry(0.33, 0.33, 0.03, 26).rotateX(Math.PI / 2), 0xc22626, x, 2.55, z - 0.04, 0, 0, 0);
        m.add(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 26).rotateX(Math.PI / 2), 0xf0ede4, x, 2.55, z - 0.04, 0, 0, 0);
        m.add(G.box, 0x121212, x - 0.08, 2.55, z - 0.065, 0, 0, 0, 0.09, 0.2, 0.012);
        m.add(G.box, 0x121212, x + 0.08, 2.55, z - 0.065, 0, 0, 0, 0.09, 0.2, 0.012);
      } else {
        m.add(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 3).rotateX(Math.PI / 2), 0xc22626, x, 2.5, z - 0.04, 0, 0, 0);
        m.add(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 3).rotateX(Math.PI / 2), 0xf0ede4, x, 2.5, z - 0.04, 0, 0, 0);
      }
      void fy;
    };
    sign(-6.35, 48, 'limit');
    sign(-6.35, 124, 'warn');
    sign(-6.35, 200, 'limit');
    // Un cruce: camino de tierra a la izquierda, con su espejo
    m.add(G.box, EARTH, 12, 0.006, 150, 0, 0, 0, 11, 0.02, 4.5);
    m.add(G.cyl, 0x8a8e92, 7.6, 1.5, 147, 0, 0, 0, 0.06, 3, 0.06);
    m.add(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 22).rotateX(Math.PI / 2), 0xd9662c, 7.45, 3, 147, 0, 0.5, 0);
    m.add(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 22).rotateX(Math.PI / 2), 0x2a3440, 7.44, 3, 146.97, 0, 0.5, 0);
  }

  /** Cinco modelos con sus ruedas, ópticas y matrículas: la pintura se tiñe por coche. */
  private buildCars() {
    const sc = this.scene;
    const WHITE = 0xf1f1ec, SIL = 0xb9bdc2, DARK = 0x262a32, RED = 0x8a2424, BLUE = 0x24345e, BEIGE = 0xc9bfa8, GRN = 0x2e4a3a;
    type K = keyof typeof SPECS;
    const R: [number, K, number][] = [[14, 'hatch', SIL], [24, 'van', WHITE], [36, 'sedan', DARK], [47, 'city', RED], [60, 'suv', BEIGE], [73, 'hatch', SIL], [85, 'van', BLUE], [100, 'sedan', WHITE], [114, 'suv', DARK], [127, 'hatch', SIL], [146, 'city', RED], [158, 'sedan', WHITE], [175, 'van', SIL], [189, 'hatch', BLUE], [204, 'suv', GRN], [221, 'city', SIL], [238, 'sedan', DARK]];
    const LF: [number, K, number][] = [[20, 'van', WHITE], [33, 'hatch', BEIGE], [44, 'suv', SIL], [58, 'sedan', DARK], [70, 'city', WHITE], [88, 'hatch', RED], [99, 'sedan', SIL], [116, 'van', WHITE], [131, 'suv', BLUE], [149, 'hatch', SIL], [165, 'sedan', GRN], [181, 'city', WHITE], [197, 'suv', RED], [214, 'van', SIL], [230, 'hatch', BEIGE]];
    const all = [
      ...R.map(([z, k, c]) => ({ x: -4.85 - ((z * 3) % 5) * 0.06, z, k, c, y: 0 })),
      ...LF.map(([z, k, c]) => ({ x: 4.85 + ((z * 7) % 5) * 0.06, z, k, c, y: Math.PI })),
    ];
    const { paint, glass, trim } = carMaterials();
    this.carMats = { paint, glass, trim };
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), ps = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    for (const k of Object.keys(SPECS) as K[]) {
      const list = all.filter((c) => c.k === k);
      const model = carModel(SPECS[k]);
      this.models[k] = model;
      if (!list.length) continue;
      const P = new THREE.InstancedMesh(model.paint, paint, list.length);
      const Gl = new THREE.InstancedMesh(model.glass, glass, list.length);
      const T = new THREE.InstancedMesh(model.trim, trim, list.length);
      list.forEach((c, i) => {
        // No todos aparcan igual de rectos
        q.setFromEuler(e.set(0, c.y + Math.sin(c.z * 2.3) * 0.022, 0));
        mt.compose(ps.set(c.x, 0, c.z), q, one);
        P.setMatrixAt(i, mt);
        Gl.setMatrixAt(i, mt);
        T.setMatrixAt(i, mt);
        P.setColorAt(i, col.set(c.c));
      });
      for (const im of [P, Gl, T]) {
        im.frustumCulled = false;
        im.userData.noCast = false;
        sc.add(im);
      }
    }
  }
  private carMats!: { paint: THREE.Material; glass: THREE.Material; trim: THREE.Material };
  private models: Record<string, ReturnType<typeof carModel>> = {};

  /** Farolas altas de hormigón, a la derecha, con su brazo y su luminaria encendida (sin charco de luz: no iluminan). */
  private buildLamps() {
    const sc = this.scene;
    const m = new Merger();
    for (let z = 4; z < LEN + 40; z += 33) this.lampZ.push(z);
    for (const z of this.lampZ) {
      m.add(new THREE.CylinderGeometry(0.07, 0.14, 8, 10), 0xc8c4bc, -6.5, 4, z);
      m.add(G.box, 0xb0aca4, -6.5, 0.6, z, 0, 0, 0, 0.34, 1.2, 0.34);
      m.add(G.box, 0x8a8e92, -6.5, 1.1, z + 0.17, 0, 0, 0, 0.14, 0.26, 0.02);
      bar(m, 0xb8b4ac, [-6.5, 7.9, z], [-5.72, 8.08, z], 0.08);
      m.add(G.rbox, 0x7e8186, -5.42, 8.06, z, 0, 0, 0, 0.84, 0.15, 0.36);
    }
    sc.add(m.mesh());
    const bulb = new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, toneMapped: false });
    // (de noche, el cómic dibuja el halo como luz de tebeo: núcleo con su aro y anillos planos)
    const halo = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const bulbGeo = new THREE.BoxGeometry(0.66, 0.03, 0.26);
    for (const z of this.lampZ) {
      const b = new THREE.Mesh(bulbGeo, bulb);
      b.position.set(-5.42, 7.975, z);
      b.userData.noCast = true;
      sc.add(b);
      const s = new THREE.Sprite(halo);
      s.position.set(-5.42, 7.9, z);
      s.scale.setScalar(3);
      sc.add(s);
    }
    // Los faroles de las cancelas
    const small = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffbb70, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
    for (const [x, y, z] of this.gateLights) {
      const s = new THREE.Sprite(small);
      s.position.set(x, y, z);
      s.scale.setScalar(1.5);
      sc.add(s);
    }
  }

  /** Los pinos: los de delante, sobre la carretera; los de detrás, el pinar hasta donde se pierde la vista. */
  private buildPines() {
    const sc = this.scene;
    // Corteza y copa de tebeo: la corteza dibujada (Surf.Bark) y la copa maciza, lisa como las del cap. 1
    const barkMat = toon({ color: 0x5a4634, roughness: 1, surf: Surf.Bark });
    const crownMat = vertexMat();
    const q = new THREE.Quaternion(), e = new THREE.Euler(), mt = new THREE.Matrix4(), ps = new THREE.Vector3(), sz = new THREE.Vector3();
    for (let v = 0; v < 3; v++) {
      const { trunk, crown } = pine(v);
      const list: [number, number, number, number][] = [];
      for (let z = -30 + v * 4; z < LEN + 40; z += 13.5 + v) {
        const j = Math.sin(z * 1.3 + v) * 2.5;
        list.push([-9.4 - Math.abs(j) * 0.5, z + j, 0.04 + Math.sin(z) * 0.2, 1.08 + Math.sin(z * 0.7) * 0.2]);
        list.push([9.9 + Math.abs(j) * 0.6, z + 6 - j, Math.PI + Math.sin(z * 2) * 0.2, 1.12 + Math.cos(z * 0.9) * 0.2]);
      }
      for (let i = 0; i < 46; i++) {
        const side = i % 2 ? 1 : -1;
        list.push([side * (17 + ((i * 13) % 34)), -20 + ((i * 47 + v * 31) % (LEN + 50)), i * 1.3, 0.85 + (i % 4) * 0.14]);
      }
      const T = new THREE.InstancedMesh(trunk, barkMat, list.length);
      const C = new THREE.InstancedMesh(crown, crownMat, list.length);
      T.frustumCulled = C.frustumCulled = false;
      C.userData.noCast = true;
      T.userData.noCast = true;
      list.forEach(([x, z, ry, s], i) => {
        q.setFromEuler(e.set(0, ry, 0));
        mt.compose(ps.set(x, 0, z), q, sz.setScalar(s));
        T.setMatrixAt(i, mt);
        C.setMatrixAt(i, mt);
      });
      sc.add(T, C);
    }
  }

  /** La placa de la calle, al empezar. */
  private buildPlate() {
    const sc = this.scene;
    // (con luz: de noche, una placa de calle no brilla sola)
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.34), new THREE.MeshStandardMaterial({ map: streetSignTexture('Camí de sa Farola'), roughness: 1 }));
    plate.position.set(-6.5, 2.9, 30.05);
    plate.rotation.y = Math.PI;
    sc.add(plate);
    sc.add(new Merger().add(G.cyl, 0x8a8e92, -6.5, 1.5, 30.12, 0, 0, 0, 0.06, 3, 0.06).add(G.box, 0x9aa0a6, -6.5, 2.9, 30.1, 0, 0, 0, 1.54, 0.38, 0.03).mesh());
  }

  /** El taxi al principio del camino; Gas, detrás. Sin foco ni haz de los faros: solo se ven encendidos. */
  private buildTaxi() {
    const t = this.taxi;
    t.azul.visible = true;
    taxiFree(t, false);
    t.root.position.set(LANE_X, 0, FROM_Z);
    this.scene.add(t.root);
    this.rig = new CarRig(t);
  }

  /** Polillas alrededor de las farolas cercanas. */
  private makeMoths() {
    const n = 40;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe2b8, size: 0.05, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    p.frustumCulled = false;
    p.userData.noCast = true;
    this.scene.add(p);
    return p;
  }

  /**
   * Gente que vuelve de Sant Joan, de blanco (y alguno ya cojeando): van hacia sus casas, en el mismo sentido que el
   * taxi, por el lado izquierdo, de cara a los coches que vienen (antes iban hacia el pueblo).
   */
  private buildWalkers() {
    const looks: PersonLook[] = [
      { skin: 0xe8c2a0, shirt: 0xf6f6f2, pants: 0x25304a, hair: 0x2b1d14, hairStyle: 'short', male: true },
      { skin: 0xf3d2b6, shirt: 0xf6f6f2, pants: 0x3b4a6b, hair: 0x7a4a26, hairStyle: 'long', shorts: true },
      { skin: 0xdcae88, shirt: 0xf6f6f2, pants: 0x25304a, hair: 0x1c1410, hairStyle: 'short', male: true },
      { skin: 0xf0cdb0, shirt: 0xf6f6f2, pants: 0x6f8fb8, hair: 0x4a2c18, hairStyle: 'pony', shorts: true },
    ];
    const at: [number, number, number][] = [[3.0, 74, 1.0], [3.42, 75, 1.0], [3.05, 146, 1.1], [3.42, 147.2, 1.1]];
    at.forEach(([x, z, v], i) => {
      const p = makePerson(looks[i], 1);
      p.root.position.set(x, 0, z);
      p.root.rotation.y = 0;
      this.scene.add(p.root);
      this.walkers.push({ p, v });
    });
  }

  /** Dos coches que vienen de frente, con las luces puestas (sin haz en el asfalto). */
  private buildOncoming() {
    const paints = [0x8a1f24, 0x2b3744];
    (['hatch', 'suv'] as const).forEach((k, i) => {
      const model = this.models[k];
      const root = new THREE.Group();
      root.userData.comicBent = true;
      const paint = (this.carMats.paint as THREE.MeshPhysicalMaterial).clone();
      paint.vertexColors = false;
      paint.color.set(paints[i]);
      root.add(new THREE.Mesh(model.paint, paint), new THREE.Mesh(model.glass, this.carMats.glass), new THREE.Mesh(model.trim, this.carMats.trim), ...carLamps(model));
      root.rotation.y = Math.PI;
      // (de dónde salen: se cruzan con el taxi a los ~5 s y a los ~11 s)
      root.position.set(1.75, 0, i ? 268 : 92);
      this.scene.add(root);
      this.oncoming.push({ root, v: 11 + i * 2 });
    });
  }

  /**
   * Arranca ya en marcha (como el coche del cap. 2: desde parado se hacía eterno) y con la cámara detrás del taxi
   * desde el primer fotograma. secs: lo que tardan en hablar, para que el camino dure eso.
   */
  start(camera: THREE.PerspectiveCamera, secs: number) {
    this.vmax = THREE.MathUtils.clamp((TO_Z - FROM_Z) / Math.max(8, secs), 7, 12);
    this.v = 5;
    this.z = FROM_Z;
    this.placeCamera(camera, 1);
  }

  /** Detrás del taxi, un poco por encima y algo a la izquierda (se ve la carretera y los pinos), siguiéndolo. */
  private placeCamera(camera: THREE.PerspectiveCamera, k: number) {
    const p = this.taxi.root.position;
    const sway = Math.sin(this.t * 0.21) * 0.9;
    this.v1.set(p.x + 0.6 + sway, 2.6, p.z - 7.4);
    camera.position.lerp(this.v1, k);
    this.camLook.lerp(this.v1.set(p.x, 1.25, p.z + 6), k);
    camera.lookAt(this.camLook);
  }

  /** Dónde habla quien va en el taxi (el bocadillo sale de su asiento). */
  speakerPoint(who: string) {
    return taxiSeat(this.taxi, who);
  }

  /**
   * Avanza el viaje; devuelve true al llegar. hold: aún les queda conversación (no llega hasta que acaben: en los
   * últimos metros va más despacio, sin pararse en mitad del camino).
   */
  update(dt: number, camera: THREE.PerspectiveCamera, hold = false) {
    this.t += dt;
    // Acelera fuerte hasta su velocidad (4,5 m/s²) y la mantiene; no frena al final: la escena siguiente lo recoge
    // en marcha por la calle de casa
    let target = this.vmax;
    if (hold) target = Math.min(target, Math.max(2.5, (RIDE_END - this.z) * 0.25));
    this.v = this.v < target ? Math.min(target, this.v + 4.5 * dt) : Math.max(target, this.v - 4 * dt);
    this.z = Math.min(RIDE_END, this.z + this.v * dt);
    const p = this.taxi.root.position;
    p.z = this.z;
    this.rig.update(dt, this.v, 0, 1.2);
    this.placeCamera(camera, Math.min(1, dt * 4.5));
    this.sun.follow(p);
    this.sky.update(camera, dt);

    // Polillas: giran alrededor de las dos farolas más cercanas a la cámara
    const focus = camera.position.z;
    for (let s = 0; s < 2; s++) {
      let best = 1e9, bz = 0;
      for (let i = s; i < this.lampZ.length; i += 2) {
        const d = Math.abs(this.lampZ[i] - focus);
        if (d < best) {
          best = d;
          bz = this.lampZ[i];
        }
      }
      (s ? this.lampB : this.lampA).set(-5.42, 7.5, bz);
    }
    const mp = this.moths.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < mp.count; i++) {
      const L = i % 2 ? this.lampA : this.lampB;
      const a = this.t * (1.8 + (i % 5) * 0.7) + i * 2.1, r = 0.4 + ((i * 7) % 10) * 0.08;
      mp.setXYZ(i, L.x + Math.cos(a) * r, 7.5 + Math.sin(a * 1.7 + i) * 0.5, L.z + Math.sin(a) * r);
    }
    mp.needsUpdate = true;

    // Los coches de frente y la gente del arcén
    for (const c of this.oncoming) c.root.position.z -= c.v * dt;
    for (const w of this.walkers) {
      w.p.root.position.z += w.v * dt;
      animatePerson(w.p, dt, 'walk', 0.32);
    }
    return (this.z >= TO_Z && !hold) || this.z >= RIDE_END;
  }
}
